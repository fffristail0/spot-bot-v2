// utils/callback.js
const PREFIX = 'x';

function make(action, payload) {
  return `${PREFIX}:${action}:${payload ?? ''}`;
}
function regex(action) {
  return new RegExp(`^${PREFIX}:${action}:(.+)$`);
}
function parse(data) {
  try {
    const parts = String(data || '').split(':');
    if (parts[0] !== PREFIX || !parts[1]) return null;
    const action = parts[1];
    const payload = parts.slice(2).join(':'); // берём всё после второго двоеточия
    return { action, payload };
  } catch (_) {
    return null;
  }
}

module.exports = { make, regex, parse };