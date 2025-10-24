const messages = require('../config/messages');
const { shareSpot, db, registerUser, claimPendingInvitesForUser } = require('../services/firebase');

module.exports = async (ctx) => {
  const userId = String(ctx.from.id);
  const username = ctx.from.username || null;

  await registerUser(userId, username);

  const payload = ctx.startPayload;

  if (payload && payload.startsWith('share_spot_')) {
    const spotId = payload.replace('share_spot_', '');

    try {
      const snap = await db.ref(`spots/${spotId}`).get();
      if (!snap.exists()) {
        return ctx.reply("❌ Спот больше не доступен");
      }

      const spot = snap.val();
      const ownerId = String(spot.ownerId || spot.userId);

      await shareSpot(spotId, ownerId, userId);

      return ctx.reply(
        `✅ Спот "${spot.title}" теперь в вашей коллекции!\n\nИспользуйте /list, чтобы его увидеть.`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.error(e);
      return ctx.reply("⚠️ Ошибка при добавлении спота");
    }
  }

  try {
    if (username) {
      const claimed = await claimPendingInvitesForUser(username, userId);
      if (claimed > 0) {
        await ctx.reply(`✅ Найдено и добавлено приглашений: ${claimed}. Используйте /list, чтобы увидеть споты.`);
        return;
      }
    }
  } catch (e) {
    console.error('claim pending invites error:', e);
  }

  return ctx.reply(messages.start);
};
