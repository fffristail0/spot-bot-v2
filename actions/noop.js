// actions/noop.js
const messages = require('../config/messages');

module.exports = async (ctx) => {
  await ctx.answerCbQuery(messages.actions.general.cancelled).catch(() => {});
};