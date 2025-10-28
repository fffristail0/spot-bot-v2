// actions/listPage.js
const messages = require('../config/messages');
const { buildCaption, buildKeyboard } = require('../utils/spotPresenter');
const { find, summarizeFilter, defaultFilter } = require('../services/filter');
const { env } = require('../config/env');
const cb = require('../utils/callback');
const { getPresignedUrlForKey, publicUrlForKey } = require('../services/s3');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolvePhotoUrl(spot) {
  if (env.S3.publicBucket) {
    if (spot.photoUrl) return spot.photoUrl;
    if (spot.photoKey) {
      try {
        return publicUrlForKey(spot.photoKey);
      } catch (_) {
        return `https://storage.yandexcloud.net/${env.S3.bucket}/${spot.photoKey}`;
      }
    }
    return spot.photoUrl || null;
  }
  if (spot.photoKey) {
    try {
      return await getPresignedUrlForKey(spot.photoKey, 3600);
    } catch (e) {
      console.error('presign error for', spot.id, e);
    }
  }
  return spot.photoUrl || null;
}

function renderFooterText(res) {
  const headerTpl =
    messages?.list?.header ||
    'Найдено: {{TOTAL}}. Показаны {{FROM}}–{{TO}} (шаг {{STEP}}). {{FILTERS}}';
  const filtersText = summarizeFilter(res.filter) || '';
  return headerTpl
    .replace('{{TOTAL}}', String(res.total))
    .replace('{{FROM}}', String(res.from))
    .replace('{{TO}}', String(res.to))
    .replace('{{STEP}}', String(env.PAGINATION.pageSize))
    .replace('{{FILTERS}}', filtersText ? `Фильтры: ${filtersText}` : '');
}

function renderFooterKeyboard(res) {
  const prevText = messages?.list?.nav?.prev || '◀️ Назад';
  const nextText = messages?.list?.nav?.next || 'Дальше ▶️';
  const filtersText = messages?.list?.nav?.filters || '🔎 Фильтры';
  const resetText = messages?.list?.nav?.reset || '♻️ Сбросить';

  const isDefault = JSON.stringify(res.filter || {}) === JSON.stringify(defaultFilter());

  const row1 = [];
  if (res.prevOffset != null) row1.push({ text: prevText, data: cb.make('plist', String(res.prevOffset)) });
  row1.push({ text: filtersText, data: cb.make('filters', 'open') });
  if (res.nextOffset != null) row1.push({ text: nextText, data: cb.make('plist', String(res.nextOffset)) });

  const rows = [[...row1].map(b => ({ text: b.text, callback_data: b.data }))];

  if (!isDefault) {
    rows.push([{ text: resetText, callback_data: cb.make('filters', 'reset') }]);
  }

  return { inline_keyboard: rows };
}

module.exports = async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});
    const payload = ctx.match?.[1];
    const requestedOffset = Math.max(0, Number(payload) || 0);
    const userId = String(ctx.from.id);

    // Блокировка от дабл-тапа
    const view = ctx.session.listView || {};
    if (view.loading) {
      return ctx.answerCbQuery(messages?.actions?.general?.cancelled || 'Подождите…').catch(() => {});
    }
    ctx.session.listView = { ...view, loading: true };

    // Пытаемся показать статус "Загружаю…"
    const loadingText = messages?.list?.loading || 'Загружаю…';
    const oldFooterId = view.footerMsgId || ctx.callbackQuery?.message?.message_id;
    if (oldFooterId) {
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, oldFooterId, undefined, loadingText);
      } catch (_) {}
    }

    let res = await find(userId, { offset: requestedOffset, limit: env.PAGINATION.pageSize });
    const newSignature = JSON.stringify(res.filter || {});
    const sigChanged = view.filterSignature && view.filterSignature !== newSignature;
    if (sigChanged && requestedOffset !== 0) {
      res = await find(userId, { offset: 0, limit: env.PAGINATION.pageSize });
    }

    if (res.total === 0) {
      const nothingText = (messages?.filters?.nothing || 'Ничего не найдено по текущим фильтрам.');
      const footerText = `${nothingText}\n\n${renderFooterText(res)}`;
      const footerKeyboard = renderFooterKeyboard(res);

      if (oldFooterId) {
        try {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            oldFooterId,
            undefined,
            footerText,
            footerKeyboard ? { reply_markup: footerKeyboard } : undefined
          );
        } catch (_) {
          await ctx.reply(footerText, footerKeyboard ? { reply_markup: footerKeyboard } : undefined);
        }
      } else {
        await ctx.reply(footerText, footerKeyboard ? { reply_markup: footerKeyboard } : undefined);
      }

      ctx.session.listView = {
        ...(ctx.session.listView || {}),
        offset: 0,
        total: 0,
        filterSignature: newSignature,
        loading: false
      };
      return;
    }

    // Удаляем предыдущие элементы (оставляем футер до отправки нового)
    if (env.PAGINATION.cleanPaging && view.itemMsgIds?.length) {
      for (const mid of view.itemMsgIds) {
        try { await ctx.deleteMessage(mid); } catch (_) {}
      }
    }

    // Отправляем новую страницу
    const newItemMsgIds = [];
    for (const spot of res.items) {
      const caption = buildCaption(spot, messages);
      const keyboard = buildKeyboard(spot.id, messages);

      try {
        if (spot.tgFileId) {
          const sent = await ctx.replyWithPhoto(spot.tgFileId, { caption, parse_mode: 'HTML', ...keyboard });
          newItemMsgIds.push(sent.message_id);
        } else {
          const photoUrl = await resolvePhotoUrl(spot);
          if (!photoUrl) {
            const sent = await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
            newItemMsgIds.push(sent.message_id);
          } else {
            const sent = await ctx.replyWithPhoto({ url: photoUrl }, { caption, parse_mode: 'HTML', ...keyboard });
            newItemMsgIds.push(sent.message_id);
          }
        }
      } catch (e) {
        console.error('replyWithPhoto failed for', spot.id, e);
        const sent = await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
        newItemMsgIds.push(sent.message_id);
      }

      await sleep(300);
    }

    // Отправляем новый футер
    const footerText = renderFooterText(res);
    const footerKeyboard = renderFooterKeyboard(res);
    const newFooter = await ctx.reply(footerText, footerKeyboard ? { reply_markup: footerKeyboard } : undefined);

    // Удаляем старый футер, если нужно
    if (env.PAGINATION.cleanPaging && view.footerMsgId) {
      try { await ctx.deleteMessage(view.footerMsgId); } catch (_) {}
    }

    // Сохраняем состояние
    ctx.session.listView = {
      offset: res.offset,
      total: res.total,
      pageSize: env.PAGINATION.pageSize,
      filterSignature: newSignature,
      itemMsgIds: newItemMsgIds,
      footerMsgId: newFooter.message_id,
      loading: false
    };
  } catch (e) {
    console.error('list page action error:', e);
    ctx.session.listView = { ...(ctx.session.listView || {}), loading: false };
    await ctx.reply(messages?.list?.error || 'Произошла ошибка при получении ваших спотов.');
  }
};