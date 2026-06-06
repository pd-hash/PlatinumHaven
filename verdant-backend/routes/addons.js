const router = require('express').Router();
const pool   = require('../db');
const { authenticate, adminOnly } = require('../middleware/auth');

router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let q = 'SELECT * FROM addons WHERE 1=1';
    const p = []; let i = 1;
    if (status && status !== 'All Status') { q += ` AND status=$${i++}`; p.push(status); }
    if (search) { q += ` AND name ILIKE $${i++}`; p.push(`%${search}%`); }
    q += ' ORDER BY name';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name, category, price, stock, total_stock, icon, description } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO addons (name, category, price, stock, total_stock, icon, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, category, price, stock, total_stock, icon, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { name, category, price, stock, total_stock, icon } = req.body;
    const { rows } = await pool.query(
      `UPDATE addons SET name=$1, category=$2, price=$3,
       stock=$4, total_stock=$5, icon=$6
       WHERE id=$7 RETURNING *`,
      [name, category, price, stock, total_stock, icon, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM addons WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;