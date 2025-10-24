const messages = require('../../../config/messages');

async function handleTitleStep(ctx) {
  await ctx.reply(messages.addSpot.askTitle);
  return ctx.wizard.next();
}

module.exports = { handleTitleStep };
