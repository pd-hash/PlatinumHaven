require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const roomsRouter = require('./routes/rooms');
const reservationsRouter = require('./routes/reservations');
const customersRouter = require('./routes/customers');
const addonsRouter = require('./routes/addons');
const dashboardRouter = require('./routes/dashboard');
const feedbackRouter = require('./routes/feedback');
const usersRouter = require('./routes/users');
const schedulesRouter = require('./routes/schedules');
const auditRouter = require('./routes/audit');
const paypalRouter = require('./routes/paypal');
const { checkConnection } = require('./db');

const app = express();

const allowedOrigins = new Set(
  [
    process.env.CLIENT_URL,
    process.env.CORS_ORIGIN,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
  })
);
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/addons', addonsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/users', usersRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/audit', auditRouter);
app.use('/api/paypal', paypalRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok', app: 'Verdant Haven API' }));

const sendDbHealth = async (_, res) => {
  try {
    const details = await checkConnection();
    res.json({ status: 'ok', database: details.database, user: details.user, connected_at: details.connected_at });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message, code: err.code });
  }
};

// Keep the original nested route and add a flatter alias in case some hosts
// treat nested health paths differently.
app.get('/api/health/db', sendDbHealth);
app.get('/api/db-health', sendDbHealth);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Verdant Haven API running on port ${PORT}`);
});

// Keep the HTTP server referenced so combined dev runners do not treat it as idle.
server.ref();
