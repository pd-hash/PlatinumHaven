const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROOM_BUCKET = process.env.SUPABASE_ROOM_BUCKET || 'room-images';
const ID_BUCKET = process.env.SUPABASE_ID_BUCKET || 'valid-ids';
const SIGNED_URL_TTL_SECONDS = Number(process.env.SUPABASE_SIGNED_URL_TTL_SECONDS || 60 * 60 * 24 * 7);

let supabaseAdmin = null;

const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

const getSupabaseAdmin = () => {
  if (!isConfigured()) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
};

const fileExtension = (filename = '') => {
  const ext = path.extname(filename).toLowerCase();
  return ext || '.jpg';
};

const fileNameFromValue = (value = '') => {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('/');
  return parts[parts.length - 1] || null;
};

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const uploadBuffer = async ({ bucket, folder, buffer, originalName, contentType, upsert = false }) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase Storage is not configured');
  }

  const filename = `${folder}-${Date.now()}${fileExtension(originalName)}`;
  const filePath = `${folder}/${filename}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, buffer, {
    contentType: contentType || 'application/octet-stream',
    upsert,
  });

  if (error) throw error;
  return { bucket, filePath };
};

const getPublicUrl = ({ bucket, filePath }) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase Storage is not configured');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
};

const createSignedUrl = async ({ bucket, filePath, expiresIn = SIGNED_URL_TTL_SECONDS }) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase Storage is not configured');
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
};

const resolveValidIdUrl = async (value) => {
  if (!value) return value;
  if (isHttpUrl(value)) return value;

  const fileName = fileNameFromValue(value);
  if (!fileName) return value;

  const supabase = getSupabaseAdmin();
  if (!supabase) return value;

  return createSignedUrl({ bucket: ID_BUCKET, filePath: value });
};

const uploadRoomImage = async (file) => {
  const result = await uploadBuffer({
    bucket: ROOM_BUCKET,
    folder: 'rooms',
    buffer: file.buffer,
    originalName: file.originalname,
    contentType: file.mimetype,
  });

  return {
    storagePath: result.filePath,
    publicUrl: getPublicUrl(result),
  };
};

const uploadCustomerId = async (file) => {
  const result = await uploadBuffer({
    bucket: ID_BUCKET,
    folder: 'ids',
    buffer: file.buffer,
    originalName: file.originalname,
    contentType: file.mimetype,
  });

  return {
    storagePath: result.filePath,
    signedUrl: await createSignedUrl(result),
  };
};

const ensureStorageConfigured = () => {
  if (!isConfigured()) {
    throw new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
};

module.exports = {
  ensureStorageConfigured,
  fileNameFromValue,
  getPublicUrl,
  getSupabaseAdmin,
  isConfigured,
  isHttpUrl,
  resolveValidIdUrl,
  uploadCustomerId,
  uploadRoomImage,
  ROOM_BUCKET,
  ID_BUCKET,
};
