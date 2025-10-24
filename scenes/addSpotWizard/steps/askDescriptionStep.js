const messages = require('../../../config/messages');

async function handleDescriptionStep(ctx) {
const text = ctx.message?.text?.trim();
if (!text) {
await ctx.reply(messages.addSpot.errors.invalidTitle);
return;
}
if (text.length > 200) {
await ctx.reply('❗ Слишком длинное название (до 200 символов).');
return;
}


ctx.wizard.state = ctx.wizard.state || {}; // добавлено
ctx.wizard.state.title = text;


await ctx.reply(messages.addSpot.askDescription);
return ctx.wizard.next();
}


module.exports = { handleDescriptionStep };