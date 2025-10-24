const { Scenes } = require('telegraf');
const { shareSpot, getAllSpots } = require('../../services/firebase');
const messages = require('../../config/messages');

const shareWizard = new Scenes.WizardScene(
    'shareWizard',
    async (ctx) => {
      ctx.wizard.state.spotId = ctx.scene.state.spotId;
      await ctx.reply(messages.shareSpot.askUsername);
      return ctx.wizard.next();
    },
    async (ctx) => {
      const username = ctx.message.text.replace('@', '').trim();
      const spotId = ctx.wizard.state.spotId;
      const fromUserId = ctx.from.id;
  
      // 🔍 1. Пробуем найти по базе
      const allSpots = await getAllSpots();
      const foundUserSpot = Object.values(allSpots).find(s => s.username === username);
  
      if (foundUserSpot) {
        const targetUserId = foundUserSpot.userId;
  
        await shareSpot(spotId, fromUserId, targetUserId);
        await ctx.reply(`✅ Спот успешно расшарен с @${username}`);
        return ctx.scene.leave();
      }
  
      // ⚠️ 2. Не нашли — предлагаем ссылку
      const link = `t.me/${ctx.botInfo.username}?start=share_spot_${spotId}`;
      await ctx.reply(
        `⚠️ Я не могу найти пользователя @${username} в базе.\n` +
        `Отправьте ему эту ссылку, чтобы он открыл бота и получил доступ к споту:\n${link}`
      );
  
      return ctx.scene.leave();
    }
  );

module.exports = shareWizard;
