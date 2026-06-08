CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  middle_name TEXT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  avatar_url TEXT,
  sex TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approval_status TEXT NOT NULL DEFAULT 'Pending',
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_id_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT UNIQUE,
  name TEXT NOT NULL,
  type TEXT,
  price NUMERIC(12, 2) DEFAULT 0,
  beds INTEGER DEFAULT 1,
  max_guests INTEGER DEFAULT 1,
  description TEXT,
  img_url TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'Available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  total_stock INTEGER NOT NULL DEFAULT 0,
  icon TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_no TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ NOT NULL,
  guests_adults INTEGER NOT NULL DEFAULT 1,
  guests_children INTEGER NOT NULL DEFAULT 0,
  special_request TEXT,
  total_amount NUMERIC(12, 2) DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'PayPal',
  status TEXT NOT NULL DEFAULT 'Pending',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  handled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  assigned_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT,
  due_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservation_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, shift_date, shift_type)
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_room_id ON housekeeping_tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_assigned_staff_id ON housekeeping_tasks(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_status ON housekeeping_tasks(status);
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_due_date ON housekeeping_tasks(due_date);
