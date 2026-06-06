const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ override: true });

const TABLES = [
  'profiles',
  'rooms',
  'addons',
  'reservations',
  'reservation_addons',
  'feedback',
  'shift_schedules',
];

const getRows = (payload, table) => {
  if (Array.isArray(payload?.[table])) return payload[table];
  if (Array.isArray(payload?.[0]?.[table])) return payload[0][table];
  return [];
};

const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;

const inferColumnType = (values) => {
  const sample = values.find((value) => value !== null && value !== undefined);
  if (sample === undefined) return 'TEXT';
  if (typeof sample === 'boolean') return 'BOOLEAN';
  if (typeof sample === 'number') return Number.isInteger(sample) ? 'INTEGER' : 'NUMERIC';
  if (typeof sample === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(sample)) return 'TIMESTAMPTZ';
  if (typeof sample === 'object') return 'JSONB';
  return 'TEXT';
};

const ensureColumns = async (client, table, rows) => {
  if (!rows.length) return;

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const existing = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  const existingColumns = new Set(existing.rows.map((row) => row.column_name));

  for (const column of columns) {
    if (existingColumns.has(column)) continue;
    const type = inferColumnType(rows.map((row) => row[column]));
    await client.query(
      `ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${quoteIdent(column)} ${type}`
    );
    console.log(`${table}: added missing column ${column} ${type}`);
  }
};

const upsertRows = async (client, table, rows) => {
  if (!rows.length) return 0;

  await ensureColumns(client, table, rows);

  const columns = Object.keys(rows[0]);
  if (!columns.length) return 0;

  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const quotedColumns = columns.map(quoteIdent).join(', ');

    const updateColumns = columns.filter((column) => column !== 'id');
    const updateSql = updateColumns.length
      ? `DO UPDATE SET ${updateColumns
          .map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`)
          .join(', ')}`
      : 'DO NOTHING';

    await client.query(
      `INSERT INTO ${quoteIdent(table)} (${quotedColumns})
       VALUES (${placeholders})
       ON CONFLICT (id) ${updateSql}`,
      values
    );
  }

  if (columns.includes('id')) {
    const sequence = await client.query("SELECT pg_get_serial_sequence($1, 'id') AS sequence", [
      table,
    ]);
    if (sequence.rows[0]?.sequence) {
      await client.query(
        `SELECT setval($1, COALESCE((SELECT MAX(id) FROM ${quoteIdent(table)}), 1), true)`,
        [sequence.rows[0].sequence]
      );
    }
  }

  return rows.length;
};

const main = async () => {
  const file = process.argv[2] || path.join(__dirname, '..', 'supabase-export.json');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  await client.query('BEGIN');
  await client.query('SET session_replication_role = replica');

  try {
    for (const table of TABLES) {
      const count = await upsertRows(client, table, getRows(payload, table));
      console.log(`${table}: imported ${count}`);
    }

    await client.query('SET session_replication_role = DEFAULT');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
