// utils/getGpsFromBuffer.js
const exifr = require('exifr');
const { exiftool } = require('exiftool-vendored');
const os = require('os');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

function toFixed6(n) {
  return Number(Number(n).toFixed(6));
}

async function readGpsWithExiftool(buffer, extHint = '.heic') {
  const tmp = path.join(os.tmpdir(), `gps-${randomUUID()}${extHint}`);
  try {
    await fs.writeFile(tmp, buffer);
    const tags = await exiftool.read(tmp);
    const lat = typeof tags.GPSLatitude === 'number' ? tags.GPSLatitude : null;
    const lon = typeof tags.GPSLongitude === 'number' ? tags.GPSLongitude : null;
    if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat: toFixed6(lat), lon: toFixed6(lon) };
    }
  } catch (e) {
    console.warn('exiftool gps parse failed:', e?.message || e);
  } finally {
    try { await fs.unlink(tmp); } catch (_) {}
  }
  return null;
}

/**
 * getGpsFromBuffer(buffer, { mimeType?, fileName? })
 */
async function getGpsFromBuffer(buffer, opts = {}) {
  // 1) Пытаемся через exifr (быстро, без внешних процессов)
  try {
    const gps = await exifr.gps(buffer);
    const { latitude, longitude } = gps || {};
    if (typeof latitude === 'number' && typeof longitude === 'number' && isFinite(latitude) && isFinite(longitude)) {
      return { lat: toFixed6(latitude), lon: toFixed6(longitude) };
    }
  } catch (e) {
    console.warn('EXIF gps parse failed:', e.message);
  }

  // 2) Если это HEIC/HEIF — fallback на exiftool
  const mime = String(opts?.mimeType || '').toLowerCase();
  const name = String(opts?.fileName || '').toLowerCase();
  const isHeif = mime.includes('heic') || mime.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif');

  if (isHeif) {
    const ext = name.endsWith('.heic') ? '.heic' : (name.endsWith('.heif') ? '.heif' : '.heic');
    const gps = await readGpsWithExiftool(buffer, ext);
    if (gps) return gps;
  }

  return null;
}

module.exports = { getGpsFromBuffer };