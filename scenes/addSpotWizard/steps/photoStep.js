const { getRegionWithCache } = require('../../../services/geocodingCache');
const { getFileBuffer } = require('../../../utils/getFileBuffer');
const { getGpsFromBuffer } = require('../../../utils/getGpsFromBuffer');
const { savePhotoToStorage } = require('../../../utils/savePhotoToStorage');
const { saveSpot } = require('../../../utils/saveSpot');
const { compressAndStrip, sanitizeNameToJpg } = require('../../../services/image');
const { buildCaption, buildKeyboard } = require('../../../utils/spotPresenter');
const { attachTgFileId } = require('../../../services/spotMeta');
const messages = require('../../../config/messages');

const MAX_MB = 20;

module.exports = {
  handlePhotoStep: async function handlePhotoStep(ctx) {
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

      await ctx.sendChatAction('upload_photo');

      // 1) Качаем оригинал
      const { buffer: originalBuffer } =
        await getFileBuffer(ctx, file, { maxBytes: MAX_MB * 1024 * 1024 });

      // 2) GPS до очистки
      const gps = await getGpsFromBuffer(originalBuffer).catch(() => null);

      // 3) Геокодинг
      const regionData = gps
        ? await getRegionWithCache(gps.lat, gps.lon).catch(() => null)
        : null;

      // 4) Очищаем EXIF и сжимаем
      const { buffer: cleanedBuffer, contentType } = await compressAndStrip(originalBuffer, {
        maxSide: Number(process.env.PHOTO_MAX_SIDE) || 1600,
        quality: Number(process.env.PHOTO_QUALITY) || 82
      });

      // 5) Загружаем в Storage очищенную картинку
      const fileName = sanitizeNameToJpg(file.file_name || 'photo.jpg');
      const photo = await savePhotoToStorage(fileName, cleanedBuffer, contentType); // { url, key }

      // 6) Сохраняем спот и получаем spotId
      const spotId = await saveSpot(ctx, photo, gps, regionData);

      // 7) Подготовка «виртуальной» модели спота для подписи
      const spotLike = {
        title: ctx.wizard.state?.title || '',
        description: ctx.wizard.state?.description || '',
        username: ctx.from?.username || ctx.from?.first_name || 'unknown',
        city: regionData?.city || null,
        region: regionData?.region || null,
        coordinates: gps ? { lat: gps.lat, lon: gps.lon } : null
      };
      const caption = buildCaption(spotLike, messages);
      const keyboard = buildKeyboard(spotId, messages);

      // 8) Отправляем одно финальное сообщение — фото с подписью и кнопками
      let tgFileId = null;
      try {
        const sent = await ctx.replyWithPhoto(
          { source: cleanedBuffer },
          { caption, parse_mode: 'HTML', ...keyboard }
        );
        tgFileId = sent.photo?.[sent.photo.length - 1]?.file_id || null;
      } catch (sendErr) {
        // Фолбэк: документ
        const sent = await ctx.replyWithDocument(
          { source: cleanedBuffer, filename: fileName },
          { caption, parse_mode: 'HTML', ...keyboard }
        );
        tgFileId = sent.document?.file_id || null;
      }

      // 9) Дописываем tgFileId к споту — чтобы /list слал через CDN TG
      if (tgFileId) {
        await attachTgFileId(spotId, tgFileId);
      }

      // 10) Выходим без лишних сообщений
      return ctx.scene.leave();
    } catch (error) {
      console.error(error);
      await ctx.reply(messages.addSpot.errors.errorAdd);
      return ctx.scene.leave();
    }
  }
};