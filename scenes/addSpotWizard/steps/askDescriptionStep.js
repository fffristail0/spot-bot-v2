const messages = require('../../../config/messages');

async function handleDescriptionStep(ctx) {
  if (!ctx.message?.text) {
    await ctx.reply(messages.addSpot.errors.invalidTitle);
    return;
  }

  ctx.wizard.state.title = ctx.message.text.trim();
  await ctx.reply(messages.addSpot.askDescription);
  return ctx.wizard.next();
}

module.exports = { handleDescriptionStep };
