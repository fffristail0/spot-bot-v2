const addSpotWizard = require('../scenes/addSpotWizard/addSpotWizard.js');

module.exports = async (ctx) => {
  try {
    await ctx.scene.enter('addSpotWizard');
  } catch (e) {
    console.error('enter addSpotWizard error:', e);
    await ctx.reply('⚠️ Не удалось запустить мастер. Попробуйте ещё раз.');
  }
};
