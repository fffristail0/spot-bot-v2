const { getRegionWithCache } = require('../../../services/geocodingCache');
const { getFileBuffer } = require('../../../utils/getFileBuffer');
const { getGpsFromBuffer } = require('../../../utils/getGpsFromBuffer');
const { savePhotoToStorage } = require('../../../utils/savePhotoToStorage');
const { saveSpot } = require('../../../utils/saveSpot');
const messages = require('../../../config/messages');

const MAX_MB = 20;

async function handlePhotoStep(ctx) {
  try {
    const file = ctx.message?.document;
    if (!file || !file.mime_type?.startsWith('image/')) {
      await ctx.reply(messages.addSpot.errors.invalidPhoto);
      return;
    }
    if (file.file_size && file.file_size > MAX_MB * 1024 * 1024) {
      await ctx.reply(`❗ Слишком большой файл (до ${MAX_MB} МБ).`);
      return;
    }

    const { buffer, contentType } = await getFileBuffer(ctx, file, { maxBytes: MAX_MB * 1024 * 1024 });
    const gps = await getGpsFromBuffer(buffer).catch(() => null);
    const regionData = gps ? await getRegionWithCache(gps.lat, gps.lon).catch(() => null) : null;

    const photo = await savePhotoToStorage(file.file_name || `photo_${Date.now()}.jpg`, buffer, contentType);

    await saveSpot(ctx, photo, gps, regionData);

    if (!gps) {
      await ctx.reply(messages.addSpot.noGpsFound);
    } else if (regionData?.city || regionData?.region) {
      await ctx.reply(`✅ Спот сохранён. Местоположение: ${regionData.city || ''}${regionData.region ? ` (${regionData.region})` : ''}`);
    } else {
      await ctx.reply('✅ Спот сохранён.');
    }

    return ctx.scene.leave();
  } catch (error) {
    console.error(error);
    await ctx.reply(messages.addSpot.errors.errorAdd);
    return ctx.scene.leave();
  }
}

module.exports = { handlePhotoStep };
