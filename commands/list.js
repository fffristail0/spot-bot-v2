const { Markup } = require('telegraf');
const { getSpots } = require('../services/firebase');
const messages = require('../config/messages');
const { getPresignedUrlForKey, publicUrlForKey } = require('../services/s3');

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolvePhotoUrl(spot) {
  const isPublic = process.env.YANDEX_PUBLIC_BUCKET === 'true';

  // Если бакет публичный — используем сохранённый URL или строим по ключу
  if (isPublic) {
    if (spot.photoUrl) return spot.photoUrl;
    if (spot.photoKey) {
      try {
        return publicUrlForKey(spot.photoKey);
      } catch (_) {
        // Фолбэк, если нет publicUrlForKey
        const bucket = process.env.YANDEX_BUCKET;
        return `https://storage.yandexcloud.net/${bucket}/${spot.photoKey}`;
      }
    }
    return spot.photoUrl || null;
  }

  // Приватный бакет — генерируем presigned по ключу
  if (spot.photoKey) {
    try {
      return await getPresignedUrlForKey(spot.photoKey, 600); // 10 минут
    } catch (e) {
      console.error('presign error for', spot.id, e);
    }
  }

  // На всякий случай, если ключа нет — попробуем старый URL (может быть ещё валиден)
  return spot.photoUrl || null;
}

module.exports = async (ctx) => {
  try {
    const spots = await getSpots(String(ctx.from.id));
    if (!spots?.length) return ctx.reply(messages.list.empty);

    for (const spot of spots) {
      let caption = `Название: <b>${escapeHtml(spot.title || '')}</b>`;
      if (spot.description) {
        caption += `\nОписание: ${escapeHtml(spot.description)}`;
      }
      if (spot.username) {
        caption += `\nДобавил: ${escapeHtml(spot.username)}`;
      }
      if (spot.region || spot.city) {
        caption += `\nМестоположение: ${escapeHtml(spot.city || '')}${spot.region ? ` (${escapeHtml(spot.region)})` : ''}`;
      }
      if (spot.coordinates) {
        const { lat, lon } = spot.coordinates;
        const MAP_PROVIDERS = {
          yandex: `https://yandex.ru/maps/?ll=${lon},${lat}&z=15&pt=${lon},${lat},pm2rdm`,
          google: `https://maps.google.com/?q=${lat},${lon}`
        };
        const selectedProvider = 'yandex';
        caption += messages.list.mapLink.replace('{{LINK}}', `<a href="${MAP_PROVIDERS[selectedProvider]}">Открыть на карте</a>`);
      }

      const photoUrl = await resolvePhotoUrl(spot);

      // Если по какой-то причине URL не получили — отправим просто текст
      if (!photoUrl) {
        await ctx.reply(caption, { parse_mode: 'HTML' });
        continue;
      }

      try {
        await ctx.replyWithPhoto(photoUrl, {
          caption,
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(messages.list.share, `share:${spot.id}`),
              Markup.button.callback('🗑️ Удалить', `del:${spot.id}`)
            ]
          ])
        });
      } catch (e) {
        console.error('replyWithPhoto failed for', spot.id, e);
        // Фолбэк: отправим текст, чтобы пользователь всё равно увидел информацию
        await ctx.reply(caption, { parse_mode: 'HTML' });
      }

      await sleep(350);
    }
  } catch (err) {
    console.error(err);
    ctx.reply(messages.list.error);
  }
};