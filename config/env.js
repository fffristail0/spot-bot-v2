// config/env.js
require('dotenv').config();

function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}
function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const env = {
  BOT: {
    token: process.env.BOT_TOKEN,
    username: process.env.BOT_USERNAME || null,
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  S3: {
    endpoint: process.env.YANDEX_ENDPOINT || '',
    region: process.env.YANDEX_REGION || 'ru-central1',
    bucket: process.env.YANDEX_BUCKET || '',
    publicBucket: toBool(process.env.YANDEX_PUBLIC_BUCKET),
    accessKeyId: process.env.YANDEX_ACCESS_KEY || '',
    secretAccessKey: process.env.YANDEX_SECRET_KEY || ''
  },

  FIREBASE: {
    databaseURL: process.env.FIREBASE_DB_URL || '',
    serviceAccountBase64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || null
  },

  DOWNLOAD: {
    timeoutMs: toInt(process.env.DOWNLOAD_TIMEOUT_MS, 45000),
    retries: toInt(process.env.DOWNLOAD_MAX_RETRIES, 3),
    backoffMs: toInt(process.env.DOWNLOAD_BACKOFF_MS, 800),
    maxBytes: toInt(process.env.DOWNLOAD_MAX_BYTES, 25 * 1024 * 1024)
  },

  PHOTO: {
    maxSide: toInt(process.env.PHOTO_MAX_SIDE, 1600),
    quality: toInt(process.env.PHOTO_QUALITY, 82)
  },

  NOMINATIM: {
    botUA: process.env.BOT_UA || 'MyPhotoSpotsBot/1.0',
    contactEmail: process.env.CONTACT_EMAIL || ''
  },

  PAGINATION: {
    pageSize: toInt(process.env.LIST_PAGE_SIZE, 10),
    cleanPaging: toBool(process.env.LIST_CLEAN_PAGING)
  }
};

function assertRequired() {
  const missing = [];
  if (!env.BOT.token) missing.push('BOT_TOKEN');
  if (!env.FIREBASE.databaseURL) missing.push('FIREBASE_DB_URL');
  if (!env.S3.bucket) missing.push('YANDEX_BUCKET');
  if (!env.S3.endpoint) missing.push('YANDEX_ENDPOINT');
  if (!env.S3.accessKeyId) missing.push('YANDEX_ACCESS_KEY');
  if (!env.S3.secretAccessKey) missing.push('YANDEX_SECRET_KEY');
  if (missing.length) {
    console.error('ENV ERROR: Missing required variables:', missing.join(', '));
    process.exit(1);
  }
}

module.exports = { env, assertRequired, toBool, toInt };