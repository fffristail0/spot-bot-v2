const { db } = require('./firebase');
const { getRegionFromCoords } = require('./geocoding');

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

async function getRegionWithCache(lat, lon) {
  const latKey = Number(lat).toFixed(5).replace(/\./g, '_');
  const lonKey = Number(lon).toFixed(5).replace(/\./g, '_');
  const key = `${latKey}_${lonKey}`;
  const ref = db.ref(`geoCache/${key}`);
  const now = Date.now();

  const snapshot = await ref.get();
  if (snapshot.exists()) {
    const val = snapshot.val();
    if (!val.cachedAt || (now - val.cachedAt) < TTL_MS) {
      return { region: val.region || null, city: val.city || null };
    }
  }

  const regionData = await getRegionFromCoords(lat, lon);
  await ref.set({ ...regionData, cachedAt: now });
  return regionData;
}

module.exports = { getRegionWithCache };
