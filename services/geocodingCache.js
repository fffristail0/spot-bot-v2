const { db } = require('./firebase');
const { getRegionFromCoords } = require('./geocoding');

async function getRegionWithCache(lat, lon) {
  // 🔹 Очищаем ключ: заменяем точки на подчеркивания
  const latKey = lat.toFixed(4).replace(/\./g, '_');
  const lonKey = lon.toFixed(4).replace(/\./g, '_');
  const key = `${latKey}_${lonKey}`;
  const cacheRef = db.ref(`geoCache/${key}`);

  // 1️⃣ Проверяем кэш
  const snapshot = await cacheRef.get();
  if (snapshot.exists()) {
    console.log('✅ Извлекаем геоданные из кэша:', key);
    return snapshot.val();
  }

  // 2️⃣ Если нет — обращаемся к Nominatim
  const regionData = await getRegionFromCoords(lat, lon);

  // 3️⃣ Сохраняем в кэш
  await cacheRef.set(regionData);
  console.log('💾 Сохранили в кэш:', key);

  return regionData;
}

module.exports = { getRegionWithCache };
