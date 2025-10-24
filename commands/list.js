const { Markup } = require('telegraf');
const { getSpots } = require('../services/firebase');
const messages = require('../config/messages');

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

      await ctx.replyWithPhoto(spot.photoUrl, {
        caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(messages.list.share, `share:${spot.id}`)]
        ])
      });
      await sleep(350);
    }
  } catch (err) {
    console.error(err);
    ctx.reply(messages.list.error);
  }
};
