// actions/delc.js
const { deleteSpotForUser } = require('../services/firebase');
const messages = require('../config/messages');

module.exports = async (ctx) => {
  const spotId = ctx.match?.[1];
  await ctx.answerCbQuery().catch(() => {});
  if (!spotId) return ctx.reply(messages.actions.delete.failed);

  try {
    const res = await deleteSpotForUser(spotId, ctx.from.id);
    try { await ctx.editMessageReplyMarkup(undefined); } catch (_) {}

    if (res?.ok) {
      if (res.action === 'deleted') return ctx.reply(messages.actions.delete.deleted);
      if (res.action === 'transferred') return ctx.reply(messages.actions.delete.transferred);
      if (res.action === 'removed_from_user') return ctx.reply(messages.actions.delete.removed);
    } else if (res?.reason === 'not_found') {
      return ctx.reply(messages.actions.delete.notFound);
    }

    return ctx.reply(messages.actions.delete.failed);
  } catch (e) {
    console.error('delete spot error', e);
    return ctx.reply(messages.actions.delete.error);
  }
};