const router = require('express').Router();
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*, p.full_name
      FROM feedback f
      LEFT JOIN profiles p ON f.customer_id = p.id
      ORDER BY f.created_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { reservation_id, rating, comment } = req.body;
    const numericRating = Number(rating);

    if (!reservation_id) {
      return res.status(400).json({ error: 'Reservation is required' });
    }

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5 stars' });
    }

    if (!String(comment || '').trim()) {
      return res.status(400).json({ error: 'Please write a short review comment' });
    }

    const reservation = await pool.query(
      `SELECT id, customer_id, status, check_out
       FROM reservations
       WHERE id = $1`,
      [reservation_id]
    );

    if (!reservation.rows[0]) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.rows[0].customer_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only review your own reservation' });
    }

    const booking = reservation.rows[0];
    const checkOut = booking.check_out ? new Date(booking.check_out) : null;
    const hasStayEnded = checkOut && !Number.isNaN(checkOut.getTime()) && checkOut <= new Date();
    const canReview = booking.status === 'Completed' || hasStayEnded;

    if (!canReview || booking.status === 'Cancelled') {
      return res.status(409).json({ error: 'You can review only completed stays' });
    }

    const existingFeedback = await pool.query(
      'SELECT id FROM feedback WHERE reservation_id = $1',
      [reservation_id]
    );

    if (existingFeedback.rows[0]) {
      return res.status(409).json({ error: 'Feedback already submitted for this reservation' });
    }

    const { rows } = await pool.query(
      `INSERT INTO feedback (customer_id, reservation_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, reservation_id, numericRating, String(comment).trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
