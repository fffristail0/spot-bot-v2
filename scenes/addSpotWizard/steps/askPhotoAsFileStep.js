const messages = require('../../../config/messages');

async function handlePhotoAsFileStep(ctx) {
const text = ctx.message?.text?.trim();
if (!text) {
await ctx.reply(messages.addSpot.errors.invalidDescription);
return;
}
if (text.length > 1000) {
await ctx.reply('❗ Слишком длинное описание (до 1000 символов).');
return;
}


ctx.wizard.state = ctx.wizard.state || {}; // добавлено
ctx.wizard.state.description = text;


await ctx.reply(messages.addSpot.askPhoto);
return ctx.wizard.next();
}


module.exports = { handlePhotoAsFileStep };