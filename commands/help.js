const messages = require('../config/messages');

module.exports = async (ctx) => {
  try {
    await ctx.reply(messages.help.text, { disable_web_page_preview: true });
  } catch (e) {
    console.error('help command error:', e);
  }
};