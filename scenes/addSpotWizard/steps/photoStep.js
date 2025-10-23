const { getRegionWithCache } = require('../../../services/geocodingCache');
const { getFileBuffer } = require('../../../utils/getFileBuffer')
const { getGpsFromBuffer } = require('../../../utils/getGpsFromBuffer')
const { savePhotoToStorage } = require('../../../utils/savePhotoToStorage')
const { saveSpot } = require('../../../utils/saveSpot')
const messages = require('../../../config/messages');

async function handlePhotoStep(ctx) {
  try {
    const file = ctx.message?.document;
    if (!file || !file.mime_type.startsWith('image/')) {
      await ctx.reply(messages.addSpot.errors.invalidPhoto);
      return;
    }

    // ⚙️ Загрузка, EXIF, кэш, формирование spotData
    const buffer = await getFileBuffer(ctx, file);
    const gps = await getGpsFromBuffer(buffer)
    let regionData = gps ? await getRegionWithCache(gps.lat, gps.lon) : null;
    const photoUrl = await savePhotoToStorage(file.file_name || `photo_${Date.now()}.jpg`, buffer);

    await saveSpot(ctx, photoUrl, gps, regionData);

    await ctx.reply(messages.addSpot.successAdd);

    return ctx.scene.leave();
  } catch (error) {
    console.error(error);
    await ctx.reply(messages.addSpot.errors.errorAdd);
    return ctx.scene.leave();
  }
}

module.exports = { handlePhotoStep };