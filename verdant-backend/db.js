const { Pool } = require('pg');
require('dotenv').config({ override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('PostgreSQL configuration error: DATABASE_URL is not set.');
}

const getSslConfig = () => {
  if (process.env.PGSSLMODE === 'disable') return false;
  if (!databaseUrl) return false;

  const hostname = new URL(databaseUrl).hostname;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1';

  return isLocal ? false : { rejectUnauthorized: false };
};

const getPoolConfig = () => {
  if (!databaseUrl) {
    return {
      ssl: false,
      connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 8000),
    };
  }

  const parsed = new URL(databaseUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: getSslConfig(),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 8000),
    family: 4,
  };
};

const pool = new Pool(getPoolConfig());

const checkConnection = async () => {
  const { rows } = await pool.query(
    'SELECT current_database() AS database, current_user AS user, NOW() AS connected_at'
  );
  return rows[0];
};

checkConnection()
  .then((details) => {
    console.log(
      `Connected to PostgreSQL database "${details.database}" as "${details.user}" at ${details.connected_at}`
    );
  })
  .catch((err) => {
    console.error(`PostgreSQL connection error: ${err.message}`);
    if (err.code) console.error(`PostgreSQL error code: ${err.code}`);
  });

pool.on('error', (err) => {
  console.error(`PostgreSQL idle client error: ${err.message}`);
});

module.exports = pool;
module.exports.checkConnection = checkConnection;
