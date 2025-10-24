const { randomUUID } = require('crypto');
const path = require('path');
const { uploadFile } = require('../services/s3');

function buildSafeKey(originalName) {
  const ext = path.extname(originalName || '') || '.jpg';
  return `photos/${new Date().toISOString().slice(0,10)}/${randomUUID()}${ext}`;
}

async function savePhotoToStorage(originalName, data, contentType) {
  const key = buildSafeKey(originalName);
  const url = await uploadFile(key, data, { contentType });
  return { url, key };
}

module.exports = { savePhotoToStorage };
