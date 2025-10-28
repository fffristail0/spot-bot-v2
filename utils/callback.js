// utils/callback.js
// Единый формат: x:<action>:<payload>
const PREFIX = 'x';

function make(action, payload) {
  return `${PREFIX}:${action}:${payload ?? ''}`;
}
function regex(action) {
  return new RegExp(`^${PREFIX}:${action}:(.+)$`);
}
function parse(data) {
  try {
    const [p, action, payload] = String(data || '').split(':');
    if (p !== PREFIX || !action) return null;
    return { action, payload: payload ?? '' };
  } catch (_) {
    return null;
  }
}

module.exports = { make, regex, parse };