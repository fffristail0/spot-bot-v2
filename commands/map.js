const messages = require('../config/messages');
const { getSpots } = require('../services/firebase');
const { uploadFile, getPresignedUrlForKey } = require('../services/s3');
const { buildKml } = require('../services/kml');

module.exports = async (ctx) => {
  try {
    const userId = String(ctx.from.id);
    const spots = await getSpots(userId);
    const withCoords = spots.filter(s => s.coordinates && typeof s.coordinates.lat === 'number' && typeof s.coordinates.lon === 'number');

    if (withCoords.length === 0) {
      return ctx.reply(messages.map?.empty || 'Нет спотов с координатами для отображения.');
    }

    const kml = buildKml(withCoords, userId);
    const key = `exports/${userId}/my_spots.kml`;

    await uploadFile(key, Buffer.from(kml, 'utf8'), {
      contentType: 'application/vnd.google-earth.kml+xml',
      cacheControl: 'no-cache'
    });
    const url = await getPresignedUrlForKey(key, 24 * 3600);

    return ctx.replyWithHTML(`🗺️ Файл KML сформирован. Скачайте и откройте в приложении:\n<a href="${url}">Все споты (KML)</a>`);
  } catch (e) {
    console.error('map command error:', e);
    return ctx.reply(messages.map?.error || '⚠️ Не удалось сформировать карту. Попробуйте позже.');
  }
};