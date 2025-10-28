// services/s3.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const mime = require('mime-types');
const { env } = require('../config/env');

const s3 = new S3Client({
  region: env.S3.region,
  endpoint: env.S3.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3.accessKeyId,
    secretAccessKey: env.S3.secretAccessKey
  },
  maxAttempts: 3
});

function sanitizeKey(name) {
  return String(name)
    .replace(/\s+/g, '_')
    .replace(/[^\w.\-\/]/g, '')
    .replace(/\/+/g, '/')
    .slice(0, 200);
}

function publicUrlForKey(key) {
  const Bucket = env.S3.bucket;
  const Key = sanitizeKey(key);
  return `https://storage.yandexcloud.net/${Bucket}/${Key}`;
}

// БАЗОВАЯ загрузка + поддержка Cache-Control
async function uploadFile(key, data, opts = {}) {
  const Bucket = env.S3.bucket;
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

  // Публичный бакет — возвращаем постоянный URL
  if (env.S3.publicBucket) {
    return publicUrlForKey(Key);
  }

  // Приватный бакет — пресайн на 10 минут
  const getCmd = new GetObjectCommand({ Bucket, Key });
  return getSignedUrl(s3, getCmd, { expiresIn: 600 });
}

// Публичная загрузка (для KML/публичных ресурсов)
async function uploadPublicFile(key, data, opts = {}) {
  const Bucket = env.S3.bucket;
  const Key = sanitizeKey(key);
  const ContentType = opts.contentType || mime.lookup(Key) || 'application/octet-stream';
  const CacheControl = opts.cacheControl;

  const command = new PutObjectCommand({
    Bucket,
    Key,
    Body: data,
    ContentType,
    ...(CacheControl ? { CacheControl } : {}),
    ACL: 'public-read'
  });
  await s3.send(command);

  return publicUrlForKey(Key);
}

async function deleteFileByKey(key) {
  const Bucket = env.S3.bucket;
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  } catch (e) {
    console.error('S3 delete error', key, e);
  }
}

async function getPresignedUrlForKey(key, expiresIn = 600) {
  const Bucket = env.S3.bucket;
  const Key = sanitizeKey(key);
  const cmd = new GetObjectCommand({ Bucket, Key });
  return getSignedUrl(s3, cmd, { expiresIn });
}

module.exports = { uploadFile, uploadPublicFile, deleteFileByKey, getPresignedUrlForKey, publicUrlForKey };