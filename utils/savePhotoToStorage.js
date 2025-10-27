const { randomUUID } = require('crypto');
const path = require('path');
const { uploadFile } = require('../services/s3');

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

function buildSafeKey(originalName, contentType) {
  const suggestedExt = EXT_BY_MIME[contentType] || null;
  const origExt = (path.extname(originalName || '') || '').toLowerCase();

  // Если мы передали тип, ему доверяем (для JPEG это .jpg)
  const ext = suggestedExt || origExt || '.jpg';

  return `photos/${new Date().toISOString().slice(0,10)}/${randomUUID()}${ext}`;
}

async function savePhotoToStorage(originalName, data, contentType) {
  const key = buildSafeKey(originalName, contentType);
  const url = await uploadFile(key, data, { contentType });
  return { url, key };
}

module.exports = { savePhotoToStorage };