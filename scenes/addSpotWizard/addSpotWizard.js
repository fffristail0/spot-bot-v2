const { Scenes } = require('telegraf');
const messages = require('../../config/messages');
const { withCancel } = require('../../utils/withCancel');
const { handleTitleStep } = require('./steps/askTitleStep');
const { handleDescriptionStep } = require('./steps/askDescriptionStep');
const { handlePhotoAsFileStep } = require('./steps/askPhotoAsFileStep');
const { handlePhotoStep } = require('./steps/photoStep');

const addSpotWizard = new Scenes.WizardScene(
  'addSpotWizard',
  handleTitleStep,
  handleDescriptionStep,
  handlePhotoAsFileStep,
  handlePhotoStep
);

addSpotWizard.enter(async (ctx) => {
  ctx.wizard.state = {};
});

addSpotWizard.leave(async (ctx) => {
  ctx.wizard.state = {};
});

module.exports = withCancel(addSpotWizard, messages.cancel.success);
