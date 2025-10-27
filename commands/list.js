const { Markup } = require('telegraf');
const { getSpots } = require('../services/firebase');
const messages = require('../config/messages');
const { getPresignedUrlForKey, publicUrlForKey } = require('../services/s3');
const { buildCaption, buildKeyboard } = require('../utils/spotPresenter');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolvePhotoUrl(spot) {
  const isPublic = process.env.YANDEX_PUBLIC_BUCKET === 'true';

  if (isPublic) {
    if (spot.photoUrl) return spot.photoUrl;
    if (spot.photoKey) {
      try {
        return publicUrlForKey(spot.photoKey);
      } catch (_) {
        const bucket = process.env.YANDEX_BUCKET;
        return `https://storage.yandexcloud.net/${bucket}/${spot.photoKey}`;
      }
    }
    return spot.photoUrl || null;
  }

  if (spot.photoKey) {
    try {
      // чуть дольше TTL — уменьшит «на грани» истечения
      return await getPresignedUrlForKey(spot.photoKey, 3600);
    } catch (e) {
      console.error('presign error for', spot.id, e);
    }
  }
  return spot.photoUrl || null;
}

module.exports = async (ctx) => {
  try {
    const spots = await getSpots(String(ctx.from.id));
    if (!spots?.length) return ctx.reply(messages.list.empty);

    for (const spot of spots) {
      const caption = buildCaption(spot, messages);
      const keyboard = buildKeyboard(spot.id, messages);

      const tgFileId = spot.tgFileId || null;

      try {
        if (tgFileId) {
          await ctx.replyWithPhoto(tgFileId, {
            caption,
            parse_mode: 'HTML',
            ...keyboard
          });
        } else {
          const photoUrl = await resolvePhotoUrl(spot);

          if (!photoUrl) {
            await ctx.reply(caption, { parse_mode: 'HTML' });
          } else {
            await ctx.replyWithPhoto(photoUrl, {
              caption,
              parse_mode: 'HTML',
              ...keyboard
            });
          }
        }
      } catch (e) {
        console.error('replyWithPhoto failed for', spot.id, e);
        await ctx.reply(caption, { parse_mode: 'HTML' });
      }

      await sleep(350);
    }
  } catch (err) {
    console.error(err);
    ctx.reply(messages.list.error);
  }
};