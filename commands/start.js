const messages = require('../config/messages');

module.exports = (ctx) => {
  ctx.reply(messages.start);
};