const { Markup } = require('telegraf');
const { getSpots } = require('../services/firebase');
const messages = require('../config/messages');

module.exports = async (ctx) => {
  try {
    const spots = await getSpots(ctx.from.id);
    if (spots.length === 0) return ctx.reply(messages.list.empty);

    for (const spot of spots) {
      let caption = `Название: ${spot.title}\nОписание: ${spot.description}\nДобавил: ${spot.username}`;
      if (spot.region || spot.city) {
        caption += `\nМестоположение: ${spot.city || ''} ${spot.region ? '(' + spot.region + ')' : ''}`;
      }
      if (spot.coordinates) {
        const { lat, lon } = spot.coordinates;
        const MAP_PROVIDERS = {
            yandex: `https://yandex.ru/maps/?ll=${lon},${lat}&z=15&pt=${lon},${lat},pm2rdm`,
            google: `https://maps.google.com/?q=${lat},${lon}`
          };
        const selectedProvider = 'yandex';
        caption += messages.list.mapLink.replace('{{LINK}}', MAP_PROVIDERS[selectedProvider]);

      }
      await ctx.replyWithPhoto(spot.photoUrl, {
        caption,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(messages.list.share, `share:${spot.id}`)]
        ])
      });
    }
  } catch (err) {
    console.error(err);
    ctx.reply(messages.list.error);
  }
};
