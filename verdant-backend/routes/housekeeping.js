const router = require('express').Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const managerOrAdmin = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or Admin access required' });
  }
  next();
};

const housekeepingStatuses = ['Pending', 'In Progress', 'Completed', 'Blocked'];

const getHousekeepingAssignee = async () => {
  const { rows } = await pool.query(
    `
      SELECT id, full_name, role, email
      FROM profiles
      WHERE role = 'staff'
        AND is_active = true
        AND (
          full_name ILIKE 'Saina'
          OR email ILIKE 'saina@haven.com'
        )
      ORDER BY CASE WHEN full_name ILIKE 'Saina' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1
    `
  );

  return rows[0] || null;
};

const ensureHousekeepingSchema = async () => {
  await pool.query(`
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
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_room_id ON housekeeping_tasks(room_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_assigned_staff_id ON housekeeping_tasks(assigned_staff_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_status ON housekeeping_tasks(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_due_date ON housekeeping_tasks(due_date)`);
};

const ensureHousekeepingTaskForReservation = async ({ reservation }) => {
  if (!reservation?.id || !reservation?.room_id) return null;
  const assignee = await getHousekeepingAssignee();

  const reservationId = reservation.id;
  const roomId = reservation.room_id;
  const dueDate = reservation.check_out || null;
  const createdBy = reservation.handled_by || null;

  const { rows } = await pool.query(
    `
      INSERT INTO housekeeping_tasks
        (reservation_id, room_id, assigned_staff_id, due_date, created_by, status)
      VALUES ($1, $2, $3, $4::date, $5, 'Pending')
      ON CONFLICT (reservation_id)
      DO UPDATE SET
        room_id = EXCLUDED.room_id,
        assigned_staff_id = COALESCE(EXCLUDED.assigned_staff_id, housekeeping_tasks.assigned_staff_id),
        due_date = COALESCE(EXCLUDED.due_date, housekeeping_tasks.due_date),
        updated_at = NOW()
      RETURNING *
    `,
    [reservationId, roomId, assignee?.id || null, dueDate, createdBy]
  );

  return rows[0] || null;
};

const hydrateTask = (row) => row;

const buildTaskQuery = (req) => {
  let query = `
    SELECT
      ht.*,
      r.room_number,
      r.name AS room_name,
      r.type AS room_type,
      p.full_name AS assigned_staff_name,
      p.role AS assigned_staff_role,
      c.full_name AS created_by_name,
      res.reservation_no,
      res.status AS reservation_status,
      res.payment_status,
      res.payment_method,
      res.check_in,
      res.check_out
    FROM housekeeping_tasks ht
    LEFT JOIN rooms r ON r.id = ht.room_id
    LEFT JOIN profiles p ON p.id = ht.assigned_staff_id
    LEFT JOIN profiles c ON c.id = ht.created_by
    LEFT JOIN reservations res ON res.id = ht.reservation_id
    WHERE 1=1
  `;
  const params = [];
  let i = 1;

  if (req.user.role === 'staff') {
    query += ` AND ht.assigned_staff_id = $${i++}`;
    params.push(req.user.id);
  }

  const { status, room_id, assigned_staff_id } = req.query;
  if (status && status !== 'All') {
    query += ` AND ht.status = $${i++}`;
    params.push(status);
  }
  if (room_id) {
    query += ` AND ht.room_id = $${i++}`;
    params.push(room_id);
  }
  if (assigned_staff_id) {
    query += ` AND ht.assigned_staff_id = $${i++}`;
    params.push(assigned_staff_id);
  }

  query += ' ORDER BY COALESCE(ht.due_date, res.check_out::date) ASC NULLS LAST, ht.created_at DESC';
  return { query, params };
};

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { query, params } = buildTaskQuery(req);
    const { rows } = await pool.query(query, params);
    res.json(rows.map(hydrateTask));
  } catch (error) {
    next(error);
  }
});

router.get('/staff', authenticate, managerOrAdmin, async (req, res, next) => {
  try {
    const assignee = await getHousekeepingAssignee();
    res.json(assignee ? [assignee] : []);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, managerOrAdmin, async (req, res, next) => {
  try {
    const { room_id, reservation_id, assigned_staff_id, status, notes, due_date } = req.body;
    let finalRoomId = room_id || null;
    let finalReservationId = reservation_id || null;
    let finalDueDate = due_date || null;

    if (!finalRoomId && !finalReservationId) {
      return res.status(400).json({ error: 'room_id or reservation_id is required' });
    }

    if (finalReservationId) {
      const { rows } = await pool.query(
        'SELECT id, room_id, check_out FROM reservations WHERE id = $1',
        [finalReservationId]
      );
      const reservation = rows[0];
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }
      finalRoomId = finalRoomId || reservation.room_id;
      finalDueDate = finalDueDate || reservation.check_out;
    }

    if (!finalRoomId) {
      return res.status(400).json({ error: 'room_id is required' });
    }

    const taskStatus = housekeepingStatuses.includes(status) ? status : 'Pending';
    const assignee = await getHousekeepingAssignee();
    if (!assignee) {
      return res.status(503).json({ error: 'Saina housekeeping account is not configured' });
    }

    if (assigned_staff_id && assigned_staff_id !== assignee.id) {
      return res.status(400).json({ error: 'Housekeeping can only be assigned to Saina' });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO housekeeping_tasks
          (reservation_id, room_id, assigned_staff_id, status, notes, due_date, created_by, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::date, $7, NOW())
        ON CONFLICT (reservation_id)
        DO UPDATE SET
          room_id = EXCLUDED.room_id,
          assigned_staff_id = COALESCE(EXCLUDED.assigned_staff_id, housekeeping_tasks.assigned_staff_id),
          status = COALESCE(EXCLUDED.status, housekeeping_tasks.status),
          notes = COALESCE(EXCLUDED.notes, housekeeping_tasks.notes),
          due_date = COALESCE(EXCLUDED.due_date, housekeeping_tasks.due_date),
          updated_at = NOW()
        RETURNING *
      `,
      [
        finalReservationId,
        finalRoomId,
        assignee.id,
        taskStatus,
        notes || null,
        finalDueDate,
        req.user.id,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const taskResult = await pool.query('SELECT * FROM housekeeping_tasks WHERE id = $1', [req.params.id]);
    const task = taskResult.rows[0];
    if (!task) {
      return res.status(404).json({ error: 'Housekeeping task not found' });
    }

    const isManager = ['admin', 'manager'].includes(req.user.role);
    const isOwner = task.assigned_staff_id && task.assigned_staff_id === req.user.id;

    if (!isManager && !isOwner) {
      return res.status(403).json({ error: 'You are not allowed to update this task' });
    }

    const nextStatus = housekeepingStatuses.includes(req.body?.status) ? req.body.status : task.status;
    const nextNotes = typeof req.body?.notes === 'string' ? req.body.notes : task.notes;
    const assignee = await getHousekeepingAssignee();
    if (!assignee) {
      return res.status(503).json({ error: 'Saina housekeeping account is not configured' });
    }
    if (req.body?.assigned_staff_id && req.body.assigned_staff_id !== assignee.id) {
      return res.status(400).json({ error: 'Housekeeping can only be assigned to Saina' });
    }
    const nextAssignee = assignee.id;
    const nextDueDate = isManager && req.body?.due_date ? req.body.due_date : task.due_date;
    const startedAt = task.started_at || (nextStatus === 'In Progress' ? new Date().toISOString() : null);
    const completedAt = nextStatus === 'Completed' ? new Date().toISOString() : task.completed_at;

    const { rows } = await pool.query(
      `
        UPDATE housekeeping_tasks
        SET
          assigned_staff_id = $1,
          status = $2,
          notes = $3,
          due_date = $4::date,
          started_at = $5,
          completed_at = $6,
          updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `,
      [nextAssignee, nextStatus, nextNotes, nextDueDate, startedAt, completedAt, req.params.id]
    );

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, managerOrAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM housekeeping_tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  router,
  ensureHousekeepingSchema,
  ensureHousekeepingTaskForReservation,
};
