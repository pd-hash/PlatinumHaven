const router = require('express').Router();
const pool   = require('../db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, adminOnly } = require('../middleware/auth');

const validIdUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads/ids');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `valid-id-${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// GET /api/users  —  all staff (not customers)
router.get('/', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, full_name, email, phone, role, is_active, created_at
      FROM profiles
      WHERE role IN ('admin', 'manager', 'staff')
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/users  —  create staff account
router.post('/', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { full_name, email, password, role, phone } = req.body;
    if (!['admin','manager','staff'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    const exists = await pool.query('SELECT id FROM profiles WHERE email=$1', [email]);
    if (exists.rows.length)
      return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password || 'Admin123', 12);
    const { rows } = await pool.query(
      `INSERT INTO profiles (full_name, email, password_hash, role, phone, is_active)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING id, full_name, email, role, is_active`,
      [full_name, email, hash, role, phone]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/users/:id  —  update role or active status
router.put('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    const { full_name, role, phone, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE profiles
       SET full_name=COALESCE($1,full_name),
           role=COALESCE($2,role),
           phone=COALESCE($3,phone),
           is_active=COALESCE($4,is_active)
       WHERE id=$5 RETURNING id, full_name, email, role, phone, is_active`,
      [full_name, role, phone, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/users/:id  —  deactivate (soft delete)
router.delete('/:id', authenticate, adminOnly, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM profiles WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
});

// GET /api/users/pending — get pending customer accounts
router.get('/pending', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, full_name, email, phone, sex, valid_id_url, 
             approval_status, created_at
      FROM profiles
      WHERE role = 'customer' 
      AND approval_status = 'Pending'
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// PUT /api/users/:id/approve — approve or reject customer
router.put('/:id/approve', authenticate, async (req, res, next) => {
  try {
    const { approval_status } = req.body;
    if (!['Approved','Rejected'].includes(approval_status))
      return res.status(400).json({ error: 'Invalid status' });

    const is_approved = approval_status === 'Approved';
    const { rows } = await pool.query(
      `UPDATE profiles 
       SET approval_status=$1, is_approved=$2
       WHERE id=$3 
       RETURNING id, full_name, email, phone, approval_status`,
      [approval_status, is_approved, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/:id/upload-valid-id', authenticate, validIdUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No ID image uploaded' });
    }

    const validIdUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/ids/${req.file.filename}`;
    const { rows } = await pool.query(
      `UPDATE profiles
       SET valid_id_url = $1
       WHERE id = $2 AND role = 'customer'
       RETURNING id, full_name, email, phone, sex, valid_id_url, approval_status, created_at`,
      [validIdUrl, req.params.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
