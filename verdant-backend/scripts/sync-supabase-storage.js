const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ override: true });

const { uploadRoomImage, uploadCustomerId, isConfigured, resolveValidIdUrl } = require('../lib/storage');

const ROOM_URL_PREFIX = 'http://localhost:5000/uploads/rooms/';
const ID_URL_PREFIX = 'http://localhost:5000/uploads/ids/';

const roomFilePath = (fileName) => path.join(__dirname, '..', 'uploads', 'rooms', fileName);
const idFilePath = (fileName) => path.join(__dirname, '..', 'uploads', 'ids', fileName);

const getFileNameFromUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return path.basename(parsed.pathname);
  } catch {
    return path.basename(value);
  }
};

const uploadRoomRows = async (client) => {
  const { rows } = await client.query(
    `SELECT id, image_url
     FROM rooms
     WHERE image_url LIKE $1`,
    [`${ROOM_URL_PREFIX}%`]
  );

  let updated = 0;
  for (const row of rows) {
    const fileName = getFileNameFromUrl(row.image_url);
    if (!fileName) continue;

    const file = roomFilePath(fileName);
    if (!fs.existsSync(file)) {
      console.warn(`rooms: missing local file ${fileName}`);
      continue;
    }

    const upload = await uploadRoomImage({
      buffer: fs.readFileSync(file),
      originalname: fileName,
      mimetype: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
    });

    await client.query('UPDATE rooms SET image_url = $1 WHERE id = $2', [upload.publicUrl, row.id]);
    updated += 1;
    console.log(`rooms: ${fileName} -> ${upload.publicUrl}`);
  }

  return updated;
};

const uploadCustomerIdRows = async (client) => {
  const { rows } = await client.query(
    `SELECT id, valid_id_url
     FROM profiles
     WHERE valid_id_url LIKE $1`,
    [`${ID_URL_PREFIX}%`]
  );

  let updated = 0;
  for (const row of rows) {
    const fileName = getFileNameFromUrl(row.valid_id_url);
    if (!fileName) continue;

    const file = idFilePath(fileName);
    if (!fs.existsSync(file)) {
      console.warn(`profiles: missing local file ${fileName}`);
      continue;
    }

    const upload = await uploadCustomerId({
      buffer: fs.readFileSync(file),
      originalname: fileName,
      mimetype: fileName.endsWith('.png') ? 'image/png' : 'image/jpeg',
    });

    await client.query('UPDATE profiles SET valid_id_url = $1 WHERE id = $2', [upload.storagePath, row.id]);
    updated += 1;
    console.log(`profiles: ${fileName} -> ${upload.storagePath}`);
  }

  return updated;
};

const main = async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!isConfigured()) {
    throw new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const roomCount = await uploadRoomRows(client);
    const idCount = await uploadCustomerIdRows(client);

    console.log(`Uploaded ${roomCount} room image(s) and ${idCount} ID image(s).`);
  } finally {
    await client.end();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
