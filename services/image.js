// services/image.js
const sharp = require('sharp');
const heicConvert = require('heic-convert');

function sanitizeNameToJpg(name = '') {
  const base = String(name).replace(/\s+/g, '_').replace(/[^\w.\-]/g, '');
  const withoutExt = base.replace(/\.[^.]+$/, '');
  return `${withoutExt || 'photo'}_${Date.now()}.jpg`;
}

// Простая проверка «похоже на HEIF»
function isHeif(buffer, hints = {}) {
  const mime = String(hints.mimeType || '').toLowerCase();
  const name = String(hints.fileName || '').toLowerCase();
  if (mime.includes('heic') || mime.includes('heif')) return true;
  if (name.endsWith('.heic') || name.endsWith('.heif')) return true;

  // Проверка по сигнатуре ISO BMFF (ftyp ... heic|heif|heix|hevc|mif1|msf1)
  if (buffer && buffer.length > 12) {
    try {
      const brand = buffer.slice(4, 12).toString('ascii'); // '\x00\x00\x00\xxxftyp'
      if (brand.includes('ftyp')) {
        const major = buffer.slice(8, 12).toString('ascii');
        if (/(heic|heif|heix|hevc|hevs|mif1|msf1)/i.test(major)) return true;
      }
    } catch (_) {}
  }
  return false;
}

async function heicToJpeg(buffer) {
  const jpeg = await heicConvert({
    buffer,
    format: 'JPEG',
    quality: 1.0 // максимум, дальше пережмём sharp'ом
  });
  return Buffer.from(jpeg);
}

async function buildPipeline(inputBuffer, opts) {
  const { maxSide, background } = opts;

  let img = sharp(inputBuffer, { failOn: 'none', limitInputPixels: 10000 * 10000 }).rotate();
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

  return img;
}

async function compressAndStrip(buffer, opts = {}) {
  const {
    maxSide = Number(process.env.PHOTO_MAX_SIDE) || 1600,
    quality = Number(process.env.PHOTO_QUALITY) || 82,
    background = '#ffffff',
    mimeType,
    fileName
  } = opts;

  const hints = { mimeType, fileName };

  // 1) Проактивная конвертация HEIC → JPEG, если похоже на HEIF
  let input = buffer;
  if (isHeif(buffer, hints)) {
    try {
      input = await heicToJpeg(buffer);
    } catch (e) {
      // если конвертер не справился — оставим как есть и попытаемся через sharp (ниже будет второй шанс)
      console.warn('heic-convert pre-conversion failed:', e?.message || e);
      input = buffer;
    }
  }

  // 2) Основной пайплайн
  try {
    const img = await buildPipeline(input, { maxSide, background });
    const out = await img.jpeg({
      quality,
      mozjpeg: true,
      chromaSubsampling: '4:2:0',
      force: true
    }).toBuffer();
    return { buffer: out, contentType: 'image/jpeg' };
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    const looksLikeHeif = msg.includes('heif') || msg.includes('libheif') || msg.includes('compression format');

    // 3) «Второй шанс»: если упало на heif — конвертируем оригинал через heic-convert и повторяем пайплайн
    if (looksLikeHeif) {
      try {
        const conv = await heicToJpeg(buffer);
        const img = await buildPipeline(conv, { maxSide, background });
        const out = await img.jpeg({
          quality,
          mozjpeg: true,
          chromaSubsampling: '4:2:0',
          force: true
        }).toBuffer();
        return { buffer: out, contentType: 'image/jpeg' };
      } catch (err2) {
        console.error('HEIC fallback failed:', err2?.message || err2);
      }
    }

    // не HEIF-проблема или оба шага провалились — пробрасываем
    throw err;
  }
}

module.exports = { compressAndStrip, sanitizeNameToJpg };