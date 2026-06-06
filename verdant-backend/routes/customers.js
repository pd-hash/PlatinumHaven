const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*,
        COUNT(r.id) AS total_bookings,
        MAX(r.check_out) AS last_visit
      FROM profiles p
      LEFT JOIN reservations r ON r.customer_id = p.id
      WHERE p.role = 'customer'
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;