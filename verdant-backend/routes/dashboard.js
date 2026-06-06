const router = require('express').Router();
const pool   = require('../db');
const { authenticate, adminOnly } = require('../middleware/auth');

const padDatePart = (value) => String(value).padStart(2, '0');

const serializeReservationDateTime = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return [
    parsed.getFullYear(),
    padDatePart(parsed.getMonth() + 1),
    padDatePart(parsed.getDate()),
  ].join('-') + ` ${padDatePart(parsed.getHours())}:${padDatePart(parsed.getMinutes())}`;
};

router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const [bookings, income, rating, weekly, monthly, recent] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM reservations"),
      pool.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM reservations
        WHERE payment_status = 'Paid'
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
      `),
      pool.query("SELECT ROUND(AVG(rating)::numeric, 1) AS avg FROM feedback"),
      pool.query(`
        SELECT DATE_TRUNC('week', created_at) AS week_start,
               TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-WW') AS week,
               TO_CHAR(DATE_TRUNC('week', created_at), 'Mon DD') AS label,
               COALESCE(SUM(total_amount), 0) AS revenue
        FROM reservations
        WHERE created_at >= NOW() - INTERVAL '12 weeks'
          AND payment_status = 'Paid'
        GROUP BY 1, 2, 3
        ORDER BY 1
      `),
      pool.query(`
        SELECT DATE_TRUNC('month', created_at) AS month_start,
               TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month_key,
               TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
               COALESCE(SUM(total_amount), 0) AS revenue
        FROM reservations
        WHERE created_at >= NOW() - INTERVAL '12 months'
          AND payment_status = 'Paid'
        GROUP BY 1, 2, 3
        ORDER BY 1
      `),
      pool.query(`
        SELECT r.*, p.full_name AS guest_name, rm.name AS room_name
        FROM reservations r
        LEFT JOIN profiles p  ON r.customer_id = p.id
        LEFT JOIN rooms    rm ON r.room_id = rm.id
        ORDER BY r.created_at DESC LIMIT 5
      `),
    ]);

    res.json({
      total_bookings:  parseInt(bookings.rows[0].count),
      monthly_income:  parseFloat(income.rows[0].total),
      avg_rating:      parseFloat(rating.rows[0].avg) || 0,
      weekly_revenue:  weekly.rows.map(({ week_start, ...row }) => row),
      monthly_trend:   monthly.rows.map(({ month_start, ...row }) => row),
      recent_bookings: recent.rows.map((booking) => ({
        ...booking,
        check_in: serializeReservationDateTime(booking.check_in),
        check_out: serializeReservationDateTime(booking.check_out),
      })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
