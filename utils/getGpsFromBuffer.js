const exifr = require('exifr');

async function getGpsFromBuffer(buffer) {
  try {
    const gps = await exifr.gps(buffer);
    const { latitude, longitude } = gps || {};
    if (typeof latitude === 'number' && typeof longitude === 'number' && isFinite(latitude) && isFinite(longitude)) {
      const lat = Number(latitude.toFixed(6));
      const lon = Number(longitude.toFixed(6));
      return { lat, lon };
    }
  } catch (e) {
    console.warn('EXIF gps parse failed:', e.message);
  }
  return null;
}

module.exports = { getGpsFromBuffer };
