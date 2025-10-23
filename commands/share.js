const { shareSpot } = require('../services/firebase');
const messages = require('../config/messages');

module.exports = async (ctx) => {
  // Usage: /share <spotId> <targetUserId>
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('Использование: /share <spotId> <targetUserId>');
  }
  const spotId = args[0];
  const target = args[1];

  try {
    await shareSpot(spotId, ctx.from.id, target);
    return ctx.reply('Спот успешно расшарен.');
  } catch (e) {
    console.error(e);
    return ctx.reply('Не удалось расшарить спот: ' + (e.message || 'ошибка'));
  }
};
