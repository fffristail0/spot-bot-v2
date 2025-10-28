const { Scenes } = require('telegraf');
const { shareSpot, getUserByUsername, spotBelongsToUser, createPendingInvite } = require('../../services/firebase');
const messages = require('../../config/messages');

const shareWizard = new Scenes.WizardScene(
  'shareWizard',
  async (ctx) => {
    ctx.wizard.state.spotId = ctx.scene.state.spotId;
    await ctx.reply(messages.shareSpot.askUsername);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const username = ctx.message?.text?.replace('@', '').trim();
    if (!username) {
      await ctx.reply(messages.shareSpot.invalidUsername);
      return;
    }
    const spotId = ctx.wizard.state.spotId;
    const fromUserId = String(ctx.from.id);

    try {
      const owns = await spotBelongsToUser(spotId, fromUserId);
      if (!owns) {
        await ctx.reply(messages.shareSpot.notAllowed);
        return ctx.scene.leave();
      }
    } catch (e) {
      console.error('Ownership check error:', e);
    }

    try {
      const user = await getUserByUsername(username);
      if (user?.userId) {
        await shareSpot(spotId, fromUserId, user.userId);
        await ctx.reply(messages.shareSpot.sharedOk(user.username || username));
        return ctx.scene.leave();
      }

      await createPendingInvite(username, spotId, fromUserId);
      await ctx.reply(messages.shareSpot.invited(username));
      return ctx.scene.leave();
    } catch (e) {
      console.error('Share wizard error:', e);
      await ctx.reply(messages.shareSpot.error);
      return ctx.scene.leave();
    }
  }
);

module.exports = shareWizard;