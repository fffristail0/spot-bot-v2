// services/geocoding.js
const fetch = require('node-fetch');

/**
 * Получает название региона или города по координатам через Nominatim
 * @param {number} lat - широта
 * @param {number} lon - долгота
 * @returns {Promise<{region: string|null, city: string|null}>}
 */
async function getRegionFromCoords(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MyPhotoSpotsBot/1.0 (https://t.me/your_bot_name)'
      }
    });

    if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

    const data = await response.json();
    const address = data.address || {};

    const region = address.state || address.region || address.county || null;
    const city = address.city || address.town || address.village || null;

    return { region, city };

  } catch (error) {
    console.error('Ошибка при геокодировании через Nominatim:', error);
    return { region: null, city: null };
  }
}

module.exports = { getRegionFromCoords };
