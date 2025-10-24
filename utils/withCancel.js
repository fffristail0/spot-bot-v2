function withCancel(scene, cancelMessage) {
  scene.command('cancel', async (ctx) => {
    await ctx.reply(cancelMessage);
    return ctx.scene.leave();
  });

  scene.hears('/cancel', async (ctx) => {
    await ctx.reply(cancelMessage);
    return ctx.scene.leave();
  });

  return scene;
}

module.exports = { withCancel };
