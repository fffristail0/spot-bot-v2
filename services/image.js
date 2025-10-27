// services/image.js
const sharp = require('sharp');

function sanitizeNameToJpg(name = '') {
  const base = String(name).replace(/\s+/g, '_').replace(/[^\w.\-]/g, '');
  const withoutExt = base.replace(/\.[^.]+$/, '');
  return `${withoutExt || 'photo'}_${Date.now()}.jpg`;
}

async function compressAndStrip(buffer, opts = {}) {
  const {
    maxSide = Number(process.env.PHOTO_MAX_SIDE) || 1600,
    quality = Number(process.env.PHOTO_QUALITY) || 82,
    background = '#ffffff',
  } = opts;

  let img = sharp(buffer, { failOn: 'none', limitInputPixels: 10000 * 10000 }).rotate();
  const meta = await img.metadata();

  if (meta.width && meta.height) {
    img = img.resize({
      width: meta.width >= meta.height ? maxSide : undefined,
      height: meta.width < meta.height ? maxSide : undefined,
      fit: 'inside',
      withoutEnlargement: true
    });
  } else {
    img = img.resize({ width: maxSide, fit: 'inside', withoutEnlargement: true });
  }

  if (meta.hasAlpha) {
    img = img.flatten({ background });
  }

  const out = await img.jpeg({
    quality,
    mozjpeg: true,
    chromaSubsampling: '4:2:0',
    force: true
  }).toBuffer();

  return { buffer: out, contentType: 'image/jpeg' };
}

module.exports = { compressAndStrip, sanitizeNameToJpg };