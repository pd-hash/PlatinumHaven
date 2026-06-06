const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');

const managerOrAdmin = (req, res, next) => {
  if (!['admin','manager'].includes(req.user.role))
    return res.status(403).json({ error: 'Manager or Admin access required' });
  next();
};

// GET /api/audit/daily?date=2025-01-06
router.get('/daily', authenticate, managerOrAdmin, async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const [checkIns, checkOuts, payments, staffActivity] = await Promise.all([
      // Check-ins today
      pool.query(`
        SELECT r.*, p.full_name AS guest_name, rm.name AS room_name,
               h.full_name AS handled_by_name
        FROM reservations r
        LEFT JOIN profiles p  ON r.customer_id = p.id
        LEFT JOIN rooms    rm ON r.room_id = rm.id
        LEFT JOIN profiles h  ON r.handled_by = h.id
        WHERE DATE(r.check_in) = $1
        ORDER BY r.created_at
      `, [date]),

      // Check-outs today
      pool.query(`
        SELECT r.*, p.full_name AS guest_name, rm.name AS room_name,
               h.full_name AS handled_by_name
        FROM reservations r
        LEFT JOIN profiles p  ON r.customer_id = p.id
        LEFT JOIN rooms    rm ON r.room_id = rm.id
        LEFT JOIN profiles h  ON r.handled_by = h.id
        WHERE DATE(r.check_out) = $1
        ORDER BY r.created_at
      `, [date]),

      // Payments collected today
      pool.query(`
        SELECT
          COUNT(*) AS total_transactions,
          COALESCE(SUM(total_amount), 0) AS total_collected,
          payment_method,
          COUNT(*) FILTER (WHERE payment_status = 'Paid') AS paid_count
        FROM reservations
        WHERE DATE(created_at) = $1
        GROUP BY payment_method
      `, [date]),

      // Staff activity today
      pool.query(`
        SELECT p.full_name, p.role,
               COUNT(r.id) AS reservations_handled
        FROM profiles p
        LEFT JOIN reservations r ON r.handled_by = p.id
        WHERE p.role IN ('admin','manager','staff')
        AND p.is_active = true
        GROUP BY p.id, p.full_name, p.role
        ORDER BY reservations_handled DESC
      `),
    ]);

    res.json({
      date,
      check_ins:      checkIns.rows,
      check_outs:     checkOuts.rows,
      payments:       payments.rows,
      staff_activity: staffActivity.rows,
      summary: {
        total_check_ins:  checkIns.rows.length,
        total_check_outs: checkOuts.rows.length,
        total_collected:  payments.rows.reduce((s, r) => s + parseFloat(r.total_collected), 0),
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
