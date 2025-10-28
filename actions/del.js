// actions/del.js
const { Markup } = require('telegraf');
const messages = require('../config/messages');

module.exports = async (ctx) => {
  try {
    const id = ctx.match?.[1];
    await ctx.answerCbQuery().catch(() => {});
    if (!id) return ctx.reply(messages.actions.delete.failed);

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback(messages.actions.delete.yes, `delc:${id}`),
        Markup.button.callback(messages.actions.delete.no, 'noop')
      ]
    ]);

    await ctx.reply(messages.actions.delete.confirm, kb);
  } catch (e) {
    console.error('del action error', e);
    await ctx.reply(messages.actions.delete.error);
  }
};