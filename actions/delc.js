// actions/delc.js
const { deleteSpotForUser } = require('../services/firebase');

module.exports = async (ctx) => {
  const spotId = ctx.match[1];
  try {
    const res = await deleteSpotForUser(spotId, ctx.from.id);
    if (res.ok && res.action === 'deleted') return ctx.reply('🗑️ Спот полностью удалён.');
    if (res.ok && res.action === 'transferred') return ctx.reply('🔁 Право владения передано следующему пользователю. Спот удалён из вашей коллекции.');
    if (res.ok && res.action === 'removed_from_user') return ctx.reply('🗑️ Спот удалён из вашей коллекции.');
    return ctx.reply('⚠️ Не удалось удалить спот.');
  } catch (e) {
    console.error('delete spot error', e);
    return ctx.reply('⚠️ Ошибка при удалении спота.');
  }
};