// actions/filters.js
const { defaultFilter, saveUserFilter } = require('../services/filter');
const messages = require('../config/messages');
const { env } = require('../config/env');
const listCommand = require('../commands/list');

module.exports = async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});
    const payload = ctx.match?.[1] || 'open';
    const userId = String(ctx.from.id);

    if (payload === 'open') {
      return ctx.scene.enter('filterWizard');
    }

    if (payload === 'reset') {
      await saveUserFilter(userId, defaultFilter());
      // по желанию: чистим текущую страницу (если включена очистка)
      if (env.PAGINATION.cleanPaging && ctx.session?.listView?.itemMsgIds) {
        for (const mid of ctx.session.listView.itemMsgIds) {
          try { await ctx.deleteMessage(mid); } catch (_) {}
        }
        if (ctx.session.listView.footerMsgId) {
          try { await ctx.deleteMessage(ctx.session.listView.footerMsgId); } catch (_) {}
        }
      }
      ctx.session.listView = null;
      await ctx.reply(messages?.filters?.resetOk || '♻️ Фильтры сброшены.');
      return listCommand(ctx);
    }
  } catch (e) {
    console.error('filters action error:', e);
  }
};