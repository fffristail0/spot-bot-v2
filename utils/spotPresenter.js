// utils/spotPresenter.js
const { Markup } = require('telegraf');

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function yandexMapUrl(lat, lon) {
  return `https://yandex.ru/maps/?ll=${lon},${lat}&z=15&pt=${lon},${lat},pm2rdm`;
}

function buildCaption(spotLike, messages) {
  // spotLike: { title, description, username, city, region, coordinates:{lat,lon} }
  let caption = `Название: <b>${escapeHtml(spotLike.title || '')}</b>`;

  if (spotLike.description) {
    caption += `\nОписание: ${escapeHtml(spotLike.description)}`;
  }
  if (spotLike.username) {
    caption += `\nДобавил: ${escapeHtml(spotLike.username)}`;
  }
  if (spotLike.region || spotLike.city) {
    caption += `\nМестоположение: ${escapeHtml(spotLike.city || '')}${spotLike.region ? ` (${escapeHtml(spotLike.region)})` : ''}`;
  }
  if (spotLike.coordinates && typeof spotLike.coordinates.lat === 'number' && typeof spotLike.coordinates.lon === 'number') {
    const { lat, lon } = spotLike.coordinates;
    const mapLink = `<a href="${yandexMapUrl(lat, lon)}">Открыть на карте</a>`;
    caption += messages.list.mapLink.replace('{{LINK}}', mapLink);
  }

  return caption;
}

function buildKeyboard(spotId, messages) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(messages.list.share, `share:${spotId}`),
      Markup.button.callback('🗑️ Удалить', `del:${spotId}`)
    ]
  ]);
}

module.exports = { buildCaption, buildKeyboard, escapeHtml, yandexMapUrl };