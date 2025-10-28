// services/geocoding.js
const { env } = require('../config/env');

async function getRegionFromCoords(lat, lon) {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'json');
    url.searchParams.set('zoom', '10');
    url.searchParams.set('addressdetails', '1');
    if (env.NOMINATIM.contactEmail) url.searchParams.set('email', env.NOMINATIM.contactEmail);

    const headers = { 'User-Agent': `${env.NOMINATIM.botUA} (+https://t.me/${env.BOT.username || 'your_bot'})` };

    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        const a = data.address || {};
        return {
          region: a.state || a.region || a.county || null,
          city: a.city || a.town || a.village || null
        };
      }
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 300 * attempt));
        continue;
      }
      console.error('Nominatim error:', res.status, await res.text());
      break;
    }
  } catch (error) {
    console.error('Ошибка при геокодировании через Nominatim:', error);
  }
  return { region: null, city: null };
}

module.exports = { getRegionFromCoords };