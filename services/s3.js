const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const mime = require('mime-types');
require('dotenv').config();

const s3 = new S3Client({
  region: process.env.YANDEX_REGION || 'ru-central1',
  endpoint: process.env.YANDEX_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.YANDEX_ACCESS_KEY,
    secretAccessKey: process.env.YANDEX_SECRET_KEY,
  },
});

function sanitizeKey(name) {
  return String(name)
    .replace(/\s+/g, '_')
    .replace(/[^\w.\-\/]/g, '')
    .replace(/\/+/g, '/')
    .slice(0, 200);
}

function publicUrlForKey(key) {
  const Bucket = process.env.YANDEX_BUCKET;
  const Key = sanitizeKey(key);
  return `https://storage.yandexcloud.net/${Bucket}/${Key}`;
}

// БАЗОВАЯ загрузка (как было) + поддержка Cache-Control
async function uploadFile(key, data, opts = {}) {
  const Bucket = process.env.YANDEX_BUCKET;
  const Key = sanitizeKey(key);
  const ContentType = opts.contentType || mime.lookup(Key) || 'application/octet-stream';
  const CacheControl = opts.cacheControl;

  const command = new PutObjectCommand({
    Bucket,
    Key,
    Body: data,
    ContentType,
    ...(CacheControl ? { CacheControl } : {})
  });
  await s3.send(command);

  if (process.env.YANDEX_PUBLIC_BUCKET === 'true') {
    // для публичного бакета вернём постоянный URL
    return publicUrlForKey(Key);
  }

  // приватный бакет — вернём пресайн на 10 минут
  const getCmd = new GetObjectCommand({ Bucket, Key });
  const signed = await getSignedUrl(s3, getCmd, { expiresIn: 600 });
  return signed;
}

// Публичная загрузка (для KML): ставим ACL public-read и возвращаем постоянный URL
async function uploadPublicFile(key, data, opts = {}) {
  const Bucket = process.env.YANDEX_BUCKET;
  const Key = sanitizeKey(key);
  const ContentType = opts.contentType || mime.lookup(Key) || 'application/octet-stream';
  const CacheControl = opts.cacheControl;

  const command = new PutObjectCommand({
    Bucket,
    Key,
    Body: data,
    ContentType,
    ...(CacheControl ? { CacheControl } : {}),
    ACL: 'public-read' // не ломает, если у бакета уже есть публичная политика
  });
  await s3.send(command);

  return publicUrlForKey(Key);
}

async function deleteFileByKey(key) {
  const Bucket = process.env.YANDEX_BUCKET;
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  } catch (e) {
    console.error('S3 delete error', key, e);
  }
}

async function getPresignedUrlForKey(key, expiresIn = 600) {
  const Bucket = process.env.YANDEX_BUCKET;
  const Key = sanitizeKey(key);
  const cmd = new GetObjectCommand({ Bucket, Key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

module.exports = { uploadFile, uploadPublicFile, deleteFileByKey, getPresignedUrlForKey, publicUrlForKey };