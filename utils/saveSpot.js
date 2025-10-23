const { addSpot } = require('../services/firebase');

async function saveSpot(ctx, photoUrl, gps, regionData) {
    const geoKey = gps ? `${gps.lat.toFixed(4).replace(/\./g,'_')}_${gps.lon.toFixed(4).replace(/\./g,'_')}` : null;
  
    const spotData = {
      title: ctx.wizard.state.title,
      description: ctx.wizard.state.description,
      photoUrl,
      username: ctx.from.username || ctx.from.first_name || 'unknown',
      userId: ctx.from.id,
      ownerId: ctx.from.id,
      createdAt: Date.now(),
      coordinates: gps ? { lat: gps.lat, lon: gps.lon } : null,
      geoKey,
      region: regionData ? (regionData.region || null) : null,
      city: regionData ? (regionData.city || null) : null
    };
  
    const key = await addSpot(spotData);
    return key;
}

module.exports = { saveSpot };