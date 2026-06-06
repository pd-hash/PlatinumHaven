const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const BASE_URL = import.meta.env.VITE_API_URL || (isLocalhost ? 'http://localhost:5000/api' : '/api');
const ALLOWED_ROLES = ['admin', 'manager', 'staff'];

export const getToken   = ()      => localStorage.getItem('vh_token');
export const setToken   = (token) => localStorage.setItem('vh_token', token);
export const clearToken = ()      => localStorage.removeItem('vh_token');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeaders(), ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const normalizeRole = (value) => {
  if (typeof value !== 'string') return value ?? null;
  const compact = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (ALLOWED_ROLES.includes(compact)) return compact;

  const aliasMap = {
    role_admin: 'admin',
    administrator: 'admin',
    role_manager: 'manager',
    frontdesk: 'staff',
    front_desk: 'staff',
    role_staff: 'staff',
  };

  return aliasMap[compact] || compact;
};

const normalizeUser = (payload) => {
  const user = payload?.user && typeof payload.user === 'object' ? payload.user : payload;
  if (!user || typeof user !== 'object') return user;
  return { ...user, role: normalizeRole(user.role) };
};

export const login  = async (email, password) => {
  const data = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (data?.token) setToken(data.token);
  return normalizeUser(data);
};
export const logout = () => clearToken();
export const getMe  = async () => normalizeUser(await request('/auth/me'));

export const getRooms = (filters = {}) => {
  const p = new URLSearchParams();
  if (filters.type   && filters.type   !== 'All Types')  p.set('type',   filters.type);
  if (filters.status && filters.status !== 'All Status') p.set('status', filters.status);
  if (filters.search) p.set('search', filters.search);
  if (filters.includeMonthlyAvailability) p.set('include_monthly_availability', 'true');
  if (filters.month) p.set('month', filters.month);
  return request(`/rooms?${p}`);
};
export const createRoom = (room)        => request('/rooms',       { method: 'POST',   body: JSON.stringify(room) });
export const updateRoom = (id, updates) => request(`/rooms/${id}`, { method: 'PUT',    body: JSON.stringify(updates) });
export const deleteRoom = (id)          => request(`/rooms/${id}`, { method: 'DELETE' });

// Upload a room image from a local file — returns the public URL
export const uploadRoomImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${BASE_URL}/rooms/upload-image`, {
    method: 'POST',
    headers: {
      // No Content-Type here — browser sets it automatically with boundary for FormData
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url; // your backend should return { url: "http://..." }
};

export const getReservations = (filters = {}) => {
  const p = new URLSearchParams();
  if (filters.status && filters.status !== 'All Statuses') p.set('status', filters.status);
  if (filters.search) p.set('search', filters.search);
  return request(`/reservations?${p}`);
};
export const createReservation = (data)        => request('/reservations',        { method: 'POST',   body: JSON.stringify(data) });
export const updateReservation = (id, updates) => request(`/reservations/${id}`,  { method: 'PUT',    body: JSON.stringify(updates) });
export const deleteReservation = (id)          => request(`/reservations/${id}`,  { method: 'DELETE' });

export const getCustomers = () => request('/customers');

export const getAddons = (filters = {}) => {
  const p = new URLSearchParams();
  if (filters.status && filters.status !== 'All Status') p.set('status', filters.status);
  if (filters.search) p.set('search', filters.search);
  return request(`/addons?${p}`);
};
export const createAddon = (data)        => request('/addons',       { method: 'POST',   body: JSON.stringify(data) });
export const updateAddon = (id, updates) => request(`/addons/${id}`, { method: 'PUT',    body: JSON.stringify(updates) });
export const deleteAddon = (id)          => request(`/addons/${id}`, { method: 'DELETE' });

export const getDashboardStats = () => request('/dashboard/stats');
export const getFeedback       = () => request('/feedback');

export const getUsers    = async ()      => {
  const users = await request('/users');
  return Array.isArray(users) ? users.map(normalizeUser) : users;
};
export const createUser  = (data)        => request('/users',       { method: 'POST',   body: JSON.stringify(data) });
export const updateUser  = (id, updates) => request(`/users/${id}`, { method: 'PUT',    body: JSON.stringify(updates) });
export const deleteUser  = (id)          => request(`/users/${id}`, { method: 'DELETE' });

export const getSchedules     = (week) => request(`/schedules?week=${week}`);
export const getScheduleStaff = ()     => request('/schedules/staff');
export const createSchedule   = (data) => request('/schedules',       { method: 'POST',   body: JSON.stringify(data) });
export const deleteSchedule   = (id)   => request(`/schedules/${id}`, { method: 'DELETE' });

export const getDailyAudit = (date) => request(`/audit/daily?date=${date}`);
export const getPendingCustomers  = ()            => request('/users/pending');
export const approveCustomer      = (id, status)  => request(`/users/${id}/approve`, { method: 'PUT', body: JSON.stringify({ approval_status: status }) });
export const uploadCustomerValidId = async (id, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE_URL}/users/${id}/upload-valid-id`, {
    method: 'POST',
    headers: {
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
};
