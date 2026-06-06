const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const passwordResetCodes = new Map();

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

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const sendPasswordResetCode = async (email, fullName, code) => {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASS;
  if (!gmailUser || !gmailPass) {
    throw new Error('Email service is not configured for password recovery');
  }

  const transporter = require('nodemailer').createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: `"The Platinum Haven" <${gmailUser}>`,
    to: email,
    subject: 'Your Platinum Haven password reset code',
    text: [
      `Dear ${fullName || 'Guest'},`,
      '',
      `Your password reset code is: ${code}`,
      '',
      'This code will expire in 10 minutes.',
      'If you did not request this change, please ignore this email.',
    ].join('\n'),
  });
};

router.post('/register', async (req, res, next) => {
  try {
    const { full_name, first_name, last_name, middle_name, email, password, phone, sex, valid_id_url } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const exists = await pool.query('SELECT id FROM profiles WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
  `INSERT INTO profiles 
   (full_name, first_name, last_name, middle_name, email, password_hash, phone, sex, valid_id_url, role, is_approved, approval_status)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'customer',false,'Pending') 
   RETURNING id, full_name, email, role, approval_status`,
  [full_name, first_name, last_name, middle_name, email, hash, phone, sex, valid_id_url || null]
  );
    // Don't return token — account needs approval first
    res.status(201).json({ token: signToken(rows[0]), user: rows[0] });
  } catch (err) { next(err); }
    });

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
    'SELECT id, full_name, first_name, last_name, middle_name, email, password_hash, role, is_approved, approval_status, phone, sex FROM profiles WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const { password_hash, ...safe } = user;
    res.json({ token: signToken(safe), user: safe });
  } catch (err) { next(err); }
});

router.post('/forgot-password/request', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { rows } = await pool.query(
      'SELECT id, role, full_name FROM profiles WHERE email = $1',
      [email]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'No account was found for that email address' });
    }

    if (user.role !== 'customer') {
      return res.status(403).json({ error: 'Password reset from the guest app is only available for customer accounts' });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    passwordResetCodes.set(email.toLowerCase(), {
      code,
      userId: user.id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    await sendPasswordResetCode(email, user.full_name, code);

    res.json({
      message: 'A 6-digit verification code has been sent to your email address.'
    });
  } catch (err) { next(err); }
});

router.post('/forgot-password/verify', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const saved = passwordResetCodes.get(String(email).toLowerCase());
    if (!saved) {
      return res.status(400).json({ error: 'No active reset request was found for that email' });
    }

    if (saved.expiresAt < Date.now()) {
      passwordResetCodes.delete(String(email).toLowerCase());
      return res.status(400).json({ error: 'The verification code has expired. Please request a new one.' });
    }

    if (saved.code !== String(code).trim()) {
      return res.status(400).json({ error: 'The verification code is invalid' });
    }

    res.json({
      message: 'Verification code confirmed. You may now choose a new password.'
    });
  } catch (err) { next(err); }
});

router.post('/forgot-password/confirm', async (req, res, next) => {
  try {
    const { email, code, new_password } = req.body;

    if (!email || !code || !new_password) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required' });
    }

    if (String(new_password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const saved = passwordResetCodes.get(String(email).toLowerCase());
    if (!saved) {
      return res.status(400).json({ error: 'No active reset request was found for that email' });
    }

    if (saved.expiresAt < Date.now()) {
      passwordResetCodes.delete(String(email).toLowerCase());
      return res.status(400).json({ error: 'The verification code has expired. Please request a new one.' });
    }

    if (saved.code !== String(code).trim()) {
      return res.status(400).json({ error: 'The verification code is invalid' });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE profiles SET password_hash = $1 WHERE id = $2', [hash, saved.userId]);
    passwordResetCodes.delete(String(email).toLowerCase());

    res.json({
      message: 'Your password has been updated successfully. You may sign in now.'
    });
  } catch (err) { next(err); }
});

router.post('/upload-id', validIdUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No ID image uploaded' });
  }
  const url = `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/ids/${req.file.filename}`;
  res.json({
    message: 'ID uploaded successfully.',
    url,
  });
});

const { authenticate } = require('../middleware/auth');
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
    'SELECT id, full_name, first_name, last_name, middle_name, email, phone, sex, role, is_approved, approval_status FROM profiles WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});  

module.exports = router;
