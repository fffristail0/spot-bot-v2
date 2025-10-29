// scenes/filterWizard/filterWizard.js
const { Scenes, Markup } = require('telegraf');
const messages = require('../../config/messages');
const { defaultFilter, getUserFilter, saveUserFilter } = require('../../services/filter');
const cb = require('../../utils/callback');
const listCommand = require('../../commands/list');

function t(path, fallback) {
  try {
    return path.split('.').reduce((a, k) => (a && a[k] != null ? a[k] : undefined), messages) ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function kbOwnership() {
  const labelAll = t('filters.ownershipOptions.all', 'Все');
  const labelOwner = t('filters.ownershipOptions.owner', 'Мои');
  const labelShared = t('filters.ownershipOptions.shared', 'Мне расшарили');
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(labelAll, cb.make('fw', 'own:all')),
      Markup.button.callback(labelOwner, cb.make('fw', 'own:owner')),
      Markup.button.callback(labelShared, cb.make('fw', 'own:shared'))
    ]
  ]);
}

function kbGps() {
  const any = t('filters.hasGpsOptions.any', 'Любые');
  const yes = t('filters.hasGpsOptions.yes', 'Только с координатами');
  const no = t('filters.hasGpsOptions.no', 'Только без координат');
  return Markup.inlineKeyboard([
    [Markup.button.callback(any, cb.make('fw', 'gps:any'))],
    [
      Markup.button.callback(yes, cb.make('fw', 'gps:yes')),
      Markup.button.callback(no, cb.make('fw', 'gps:no'))
    ]
  ]);
}

function kbPeriod() {
  const all = t('filters.periodOptions.all', 'За всё время');
  const d7 = t('filters.periodOptions.d7', '7 дней');
  const d30 = t('filters.periodOptions.d30', '30 дней');
  const d90 = t('filters.periodOptions.d90', '90 дней');
  return Markup.inlineKeyboard([
    [Markup.button.callback(all, cb.make('fw', 'per:all'))],
    [
      Markup.button.callback(d7, cb.make('fw', 'per:7')),
      Markup.button.callback(d30, cb.make('fw', 'per:30')),
      Markup.button.callback(d90, cb.make('fw', 'per:90'))
    ]
  ]);
}

function kbSkip() {
  const skip = t('filters.skip', 'Пропустить');
  return Markup.inlineKeyboard([[Markup.button.callback(skip, cb.make('fw', 'text:skip'))]]);
}

// Универсальный рендер: редактирует предыдущее «мастер»-сообщение сцены или создаёт новое
async function renderStep(ctx, text, keyboard) {
  const chatId = ctx.chat.id;
  const msgId = ctx.wizard.state.msgId;
  const replyMarkup = keyboard?.reply_markup || keyboard; // поддержка Markup.inlineKeyboard
  try {
    if (msgId) {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
      return msgId;
    }
  } catch (_) {
    // если не удалось отредактировать (удалено/старое/иное) — отправим новое
  }
  const sent = await ctx.reply(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
  ctx.wizard.state.msgId = sent.message_id;
  return sent.message_id;
}

async function deleteWizardMessage(ctx) {
  const msgId = ctx.wizard.state.msgId;
  if (!msgId) return;
  try { await ctx.deleteMessage(msgId); } catch (_) {}
  ctx.wizard.state.msgId = undefined;
}

const filterWizard = new Scenes.WizardScene(
  'filterWizard',

  // Step 0: старт — показываем выбор владения
  async (ctx) => {
    if (ctx.message?.text === '/cancel') {
      await ctx.reply(t('cancel.success', '🚪 Вы вышли из текущего режима.'));
      return ctx.scene.leave();
    }
    try {
      const current = await getUserFilter(String(ctx.from.id));
      ctx.wizard.state.filter = { ...current };
    } catch {
      ctx.wizard.state.filter = defaultFilter();
    }
    const title = t('filters.title', 'Настройка фильтра');
    const own = t('filters.ownership', 'Какие споты показывать?');
    await renderStep(ctx, `${title}\n\n${own}`, kbOwnership());
    return ctx.wizard.next();
  },

  // Step 1: ownership -> gps
  async (ctx) => {
    if (ctx.message?.text === '/cancel') {
      await deleteWizardMessage(ctx);
      await ctx.reply(t('cancel.success', '🚪 Вы вышли из текущего режима.'));
      return ctx.scene.leave();
    }
    if (ctx.callbackQuery?.data) {
      const parsed = cb.parse(ctx.callbackQuery.data);
      if (parsed?.action === 'fw') {
        const [key, val] = String(parsed.payload || '').split(':');
        if (key === 'own' && ['all', 'owner', 'shared'].includes(val)) {
          ctx.wizard.state.filter.ownership = val;
          await ctx.answerCbQuery().catch(() => {});
          const gps = t('filters.hasGps', 'Фильтр по координатам');
          await renderStep(ctx, gps, kbGps());
          return ctx.wizard.next();
        }
      }
    }
  },

  // Step 2: gps -> period
  async (ctx) => {
    if (ctx.message?.text === '/cancel') {
      await deleteWizardMessage(ctx);
      await ctx.reply(t('cancel.success', '🚪 Вы вышли из текущего режима.'));
      return ctx.scene.leave();
    }
    if (ctx.callbackQuery?.data) {
      const parsed = cb.parse(ctx.callbackQuery.data);
      if (parsed?.action === 'fw') {
        const [key, val] = String(parsed.payload || '').split(':');
        if (key === 'gps' && ['any', 'yes', 'no'].includes(val)) {
          ctx.wizard.state.filter.hasGps = val;
          await ctx.answerCbQuery().catch(() => {});
          const per = t('filters.period', 'За какой период?');
          await renderStep(ctx, per, kbPeriod());
          return ctx.wizard.next();
        }
      }
    }
  },

  // Step 3: period -> text
  async (ctx) => {
    if (ctx.message?.text === '/cancel') {
      await deleteWizardMessage(ctx);
      await ctx.reply(t('cancel.success', '🚪 Вы вышли из текущего режима.'));
      return ctx.scene.leave();
    }
    if (ctx.callbackQuery?.data) {
      const parsed = cb.parse(ctx.callbackQuery.data);
      if (parsed?.action === 'fw') {
        const [key, val] = String(parsed.payload || '').split(':');
        if (key === 'per') {
          const days = val === 'all' ? null : Number(val);
          ctx.wizard.state.filter.periodDays = days;
          await ctx.answerCbQuery().catch(() => {});
          const textQ = t('filters.text', 'Введите поисковую строку или нажмите «Пропустить».');
          await renderStep(ctx, textQ, kbSkip());
          return ctx.wizard.next();
        }
      }
    }
  },

  // Step 4: text -> save
  async (ctx) => {
    if (ctx.message?.text === '/cancel') {
      await deleteWizardMessage(ctx);
      await ctx.reply(t('cancel.success', '🚪 Вы вышли из текущего режима.'));
      return ctx.scene.leave();
    }

    // обработка "Пропустить"
    if (ctx.callbackQuery?.data) {
      const parsed = cb.parse(ctx.callbackQuery.data);
      if (parsed?.action === 'fw' && parsed.payload === 'text:skip') {
        ctx.wizard.state.filter.text = null;
        await ctx.answerCbQuery().catch(() => {});
      } else {
        return; // ждём корректного действия
      }
    }

    // или текстовое сообщение пользователя
    if (ctx.message?.text && ctx.message.text !== '/cancel') {
      const text = String(ctx.message.text || '').trim();
      ctx.wizard.state.filter.text = text || null;
    }

    // Сохраняем и аккуратно завершаем сцену
    const f = ctx.wizard.state.filter || defaultFilter();
    try {
      await renderStep(ctx, t('filters.saved', '✅ Фильтр сохранён. Показаны свежие результаты.'));
    } catch (_) {}
    await saveUserFilter(String(ctx.from.id), f).catch(() => {});

    // Удаляем мастер-сообщение сцены, чтобы не оставлять «хвост»
    await deleteWizardMessage(ctx);

    await ctx.scene.leave();
    // Показываем первую страницу листинга по новым фильтрам
    return listCommand(ctx);
  }
);

module.exports = filterWizard;