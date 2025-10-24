const messages = require('../config/messages');
const { shareSpot, db } = require('../services/firebase');

async function registerUser(userId, username) {
  try {
    await db.ref(`users/${userId}`).update({
      username: username || null,
      updatedAt: Date.now()
    });
  } catch (e) {
    console.error("User registration error:", e);
  }
}

module.exports = async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || null;

  // ✅ Регистрируем пользователя
  await registerUser(userId, username);

  const payload = ctx.startPayload;

  // ✅ Если перешёл по ссылке расшаривания спота
  if (payload && payload.startsWith('share_spot_')) {
    const spotId = payload.replace('share_spot_', '');

    try {
      const snap = await db.ref(`spots/${spotId}`).get();
      if (!snap.exists()) {
        return ctx.reply("❌ Спот больше не доступен");
      }

      const spot = snap.val();
      const ownerId = spot.ownerId || spot.userId;

      await shareSpot(spotId, ownerId, userId);

      return ctx.reply(
        `✅ Спот *"${spot.title}"* теперь в вашей коллекции!\n\nИспользуйте /list, чтобы его увидеть.`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      console.error(e);
      return ctx.reply("⚠️ Ошибка при добавлении спота");
    }
  }

  // ✅ Обычный старт
  return ctx.reply(messages.start);
};
