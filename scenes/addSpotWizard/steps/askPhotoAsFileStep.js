const messages = require('../../../config/messages');

async function handlePhotoAsFileStep(ctx) {
    if (!ctx.message?.text) {
        ctx.wizard.state.description = ctx.message.text.trim();
        await ctx.reply(
          messages.addSpot.askPhoto,
          { parse_mode: 'Markdown' }
        );
        return ctx.wizard.next();
      }
      ctx.wizard.state.description = ctx.message.text.trim();
      await ctx.reply(
        messages.addSpot.askPhoto,
        { parse_mode: 'Markdown' }
      );
      return ctx.wizard.next();
}

module.exports = { handlePhotoAsFileStep };
