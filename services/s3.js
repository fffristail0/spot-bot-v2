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

async function uploadFile(key, data, opts = {}) {
  const Bucket = process.env.YANDEX_BUCKET;
  const Key = sanitizeKey(key);
  const ContentType = opts.contentType || mime.lookup(Key) || 'application/octet-stream';

  const command = new PutObjectCommand({
    Bucket,
    Key,
    Body: data,
    ContentType
  });
  await s3.send(command);

  if (process.env.YANDEX_PUBLIC_BUCKET === 'true') {
    return `https://storage.yandexcloud.net/${Bucket}/${Key}`;
  }

  const getCmd = new GetObjectCommand({ Bucket, Key });
  const signed = await getSignedUrl(s3, getCmd, { expiresIn: 600 });
  return signed;
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

module.exports = { uploadFile, deleteFileByKey };
