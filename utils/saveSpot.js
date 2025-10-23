const { addSpot } = require('../services/firebase');

async function saveSpot(ctx, photoUrl, gps, regionData) {
    const geoKey = gps ? `${gps.lat.toFixed(4).replace(/\./g,'_')}_${gps.lon.toFixed(4).replace(/\./g,'_')}` : null;
  
    const spotData = {
      title: ctx.wizard.state.title,
      description: ctx.wizard.state.description,
      photoUrl,
      username: ctx.from.username || ctx.from.first_name || 'unknown',
      userId: ctx.from.id,
      coordinates: gps,
      geoKey,
      region: regionData?.region || null,
      city: regionData?.city || null
    };
  
    await addSpot(spotData);
  }
  
  module.exports = {saveSpot}