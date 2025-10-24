const { addSpot } = require('../services/firebase');

function clampStr(s, max) {
  if (!s) return null;
  s = String(s).trim();
  return s.length > max ? s.slice(0, max) : s;
}

async function saveSpot(ctx, photo, gps, regionData) {
  const title = clampStr(ctx.wizard?.state?.title, 200);
  const description = clampStr(ctx.wizard?.state?.description, 1000);

  const userId = String(ctx.from.id);
  const username = ctx.from.username || ctx.from.first_name || 'unknown';

  const spotData = {
    title,
    description,
    photoUrl: photo?.url,
    photoKey: photo?.key || null,
    username,
    userId,
    ownerId: userId,
    createdAt: Date.now(),
    coordinates: gps ? { lat: gps.lat, lon: gps.lon } : null,
    geoKey: gps ? `${gps.lat.toFixed(4).replace(/\./g,'_')}_${gps.lon.toFixed(4).replace(/\./g,'_')}` : null,
    region: regionData?.region || null,
    city: regionData?.city || null
  };

  const key = await addSpot(spotData);
  return key;
}

module.exports = { saveSpot };
