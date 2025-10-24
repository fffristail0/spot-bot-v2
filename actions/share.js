const addSpotWizard = require('../scenes/shareWizard/shareWizard.js');

module.exports = async (ctx) => {
    const spotId = ctx.match[1];
    return ctx.scene.enter('shareWizard', { spotId });
  }