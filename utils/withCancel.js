function withCancel(scene, cancelMessage) {
    // Обрабатываем команду /cancel внутри сцены
    scene.command('cancel', async (ctx) => {
      await ctx.reply(cancelMessage);
      return ctx.scene.leave();
    });
  
    // Также ловим текст "/cancel" — иногда Telegram присылает его как обычное сообщение
    scene.hears('/cancel', async (ctx) => {
      await ctx.reply(cancelMessage);
      return ctx.scene.leave();
    });
  
    return scene;
  }
  
  module.exports = { withCancel };