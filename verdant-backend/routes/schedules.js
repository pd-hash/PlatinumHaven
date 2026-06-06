const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');

const managerOrAdmin = (req, res, next) => {
  if (!['admin','manager'].includes(req.user.role))
    return res.status(403).json({ error: 'Manager or Admin access required' });
  next();
};

// GET /api/schedules?week=2025-01-06
router.get('/', authenticate, managerOrAdmin, async (req, res, next) => {
  try {
    const { week } = req.query;
    let query = `
      SELECT s.*,
        p.full_name AS staff_name,
        p.role      AS staff_role,
        c.full_name AS created_by_name
      FROM shift_schedules s
      LEFT JOIN profiles p ON s.staff_id  = p.id
      LEFT JOIN profiles c ON s.created_by = c.id
      WHERE 1=1
    `;
    const params = [];
    if (week) {
      query += ` AND s.shift_date >= $1 AND s.shift_date < ($1::date + INTERVAL '7 days')`;
      params.push(week);
    }
    query += ' ORDER BY s.shift_date, s.shift_type';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/schedules  —  assign a shift
router.post('/', authenticate, managerOrAdmin, async (req, res, next) => {
  try {
    const { staff_id, shift_date, shift_type, notes } = req.body;

    // Check for duplicate
    const dup = await pool.query(
      'SELECT id FROM shift_schedules WHERE staff_id=$1 AND shift_date=$2 AND shift_type=$3',
      [staff_id, shift_date, shift_type]
    );
    if (dup.rows.length)
      return res.status(409).json({ error: 'Staff already assigned to this shift' });

    const { rows } = await pool.query(
      `INSERT INTO shift_schedules (staff_id, shift_date, shift_type, notes, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [staff_id, shift_date, shift_type, notes, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/schedules/:id
router.delete('/:id', authenticate, managerOrAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM shift_schedules WHERE id=$1', [req.params.id]);
    res.json({ message: 'Shift removed' });
  } catch (err) { next(err); }
});

// GET /api/schedules/staff  —  get all staff for dropdown
router.get('/staff', authenticate, managerOrAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, full_name, role FROM profiles
      WHERE role IN ('admin','manager','staff')
      AND is_active = true
      ORDER BY full_name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;