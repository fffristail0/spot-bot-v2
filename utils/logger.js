// utils/logger.js
const levels = ['error', 'warn', 'info', 'debug'];

function createLogger(ns = '', level = 'info') {
  const idx = levels.indexOf(level);
  const prefix = ns ? `[${ns}]` : '';
  const ts = () => new Date().toISOString();

  const log = (l, ...args) => {
    const li = levels.indexOf(l);
    if (li <= idx) {
      // eslint-disable-next-line no-console
      console[l === 'debug' ? 'log' : l](`${ts()} ${prefix}`, ...args);
    }
  };

  return {
    error: (...a) => log('error', ...a),
    warn:  (...a) => log('warn', ...a),
    info:  (...a) => log('info', ...a),
    debug: (...a) => log('debug', ...a)
  };
}

module.exports = { createLogger };