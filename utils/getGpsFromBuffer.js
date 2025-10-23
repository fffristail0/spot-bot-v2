const exifr = require('exifr');

async function getGpsFromBuffer(buffer) {
    try {
      const exifData = await exifr.gps(buffer);
      if (exifData?.latitude && exifData?.longitude) {
        return { lat: exifData.latitude, lon: exifData.longitude };
      }
    } catch {}
    return null;
  }

  module.exports = {getGpsFromBuffer}