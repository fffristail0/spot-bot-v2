module.exports = async (ctx) => {
  const id = ctx.match[1];
  await ctx.reply(`Удалить спот?`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Да', callback_data: `delc:${id}` }, { text: 'Нет', callback_data: 'noop' }]
      ]
    }
  });
};