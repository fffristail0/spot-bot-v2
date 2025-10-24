const messages = require('../config/messages');
const { getSpots } = require('../services/firebase');
const { uploadPublicFile, publicUrlForKey } = require('../services/s3');

function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildKml(spots, userId) {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>My Spots</name>
  <Style id="ownerStyle">
    <IconStyle>
      <color>ff00a000</color>
      <scale>1.1</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon>
    </IconStyle>
  </Style>
  <Style id="sharedStyle">
    <IconStyle>
      <color>ffa000ff</color>
      <scale>1.1</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon>
    </IconStyle>
  </Style>
`;
  const body = spots.map(s => {
    const c = s.coordinates;
    if (!c || typeof c.lat !== 'number' || typeof c.lon !== 'number') return '';
    const owned = String(s.ownerId || s.userId) === userId;
    const styleUrl = owned ? '#ownerStyle' : '#sharedStyle';
    const name = escapeXml(s.title || 'Spot');
    const desc = escapeXml(s.description || '');
    return `  <Placemark>
    <name>${name}</name>
    ${desc ? `<description>${desc}</description>` : ''}
    <styleUrl>${styleUrl}</styleUrl>
    <Point><coordinates>${c.lon},${c.lat},0</coordinates></Point>
  </Placemark>
`;
  }).join('');
  const footer = '</Document></kml>';
  return header + body + footer;
}

module.exports = async (ctx) => {
  try {
    const userId = String(ctx.from.id);
    const spots = await getSpots(userId);
    const withCoords = spots.filter(s => s.coordinates && typeof s.coordinates.lat === 'number' && typeof s.coordinates.lon === 'number');

    if (withCoords.length === 0) {
      return ctx.reply(messages.map?.empty || 'Нет спотов с координатами для отображения.');
    }

    const kml = buildKml(withCoords, userId);
    const buf = Buffer.from(kml, 'utf8');

    // Фиксированный ключ — перезаписываем и держим постоянную ссылку
    const key = `exports/${userId}/my_spots.kml`;

    const url = await uploadPublicFile(key, buf, {
      contentType: 'application/vnd.google-earth.kml+xml',
      cacheControl: 'no-cache'
    });

    return ctx.replyWithHTML(
      `🗺️ Файл KML сформирован. Скачайте и откройте в приложении:\n` +
      `<a href="${url}">Все споты (KML)</a>`
    );
  } catch (e) {
    console.error('map command error:', e);
    return ctx.reply(messages.map?.error || '⚠️ Не удалось сформировать карту. Попробуйте позже.');
  }
};