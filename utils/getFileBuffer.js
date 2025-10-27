const { Readable } = require('stream');

const DEFAULTS = {
  timeoutMs: Number(process.env.DOWNLOAD_TIMEOUT_MS) || 45000,         // 45s
  maxRetries: Number(process.env.DOWNLOAD_MAX_RETRIES) || 3,          // 3 повтора
  backoffMs: Number(process.env.DOWNLOAD_BACKOFF_MS) || 800,          // базовая пауза
  maxBytes: Number(process.env.DOWNLOAD_MAX_BYTES) || 25 * 1024 * 1024 // 25MB
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const withJitter = (ms) => Math.round(ms * (0.7 + Math.random() * 0.6)); // 70–130%

async function fetchToBuffer(url, { maxBytes, timeoutMs, maxRetries, backoffMs }) {
  let lastErr;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(typeof url === 'string' ? url : url.toString(), { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const declaredLen = Number(res.headers.get('content-length') || 0);
      if (declaredLen && declaredLen > maxBytes) {
        throw new Error(`File too large: ${declaredLen} > ${maxBytes}`);
      }

      let body = res.body;
      if (!body) throw new Error('Empty response body');

      // Web ReadableStream -> Node Readable
      if (typeof body.getReader === 'function') {
        body = Readable.fromWeb(body);
      }

      const chunks = [];
      let total = 0;

      for await (const chunk of body) {
        total += chunk.length;
        if (total > maxBytes) {
          controller.abort();
          throw new Error(`File exceeded limit: ${total} > ${maxBytes}`);
        }
        chunks.push(chunk);
      }

      clearTimeout(timeout);
      return { buffer: Buffer.concat(chunks, total), contentType };
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;

      // Последняя попытка — выходим
      if (attempt === maxRetries) break;

      // Повторяем только на «временных» сбоях
      const isAbort = err?.name === 'AbortError';
      const msg = String(err?.message || '');
      const transient =
        isAbort ||
        /timeout|aborted|network|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(msg);

      if (!transient) {
        throw err;
      }

      const wait = withJitter(backoffMs * Math.pow(2, attempt));
      await sleep(wait);
      continue;
    }
  }

  throw lastErr || new Error('download failed');
}

async function getFileBuffer(ctx, file, opts = {}) {
  const maxBytes = opts.maxBytes ?? DEFAULTS.maxBytes;
  const timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxRetries = opts.maxRetries ?? DEFAULTS.maxRetries;
  const backoffMs = opts.backoffMs ?? DEFAULTS.backoffMs;

  // Ранняя проверка размера из Telegram (если поле есть)
  if (file?.file_size && file.file_size > maxBytes) {
    throw new Error(`File too large (telegram): ${file.file_size} > ${maxBytes}`);
  }

  const link = await ctx.telegram.getFileLink(file.file_id);
  const url = typeof link === 'string' ? link : link.href || link.toString();

  return await fetchToBuffer(url, { maxBytes, timeoutMs, maxRetries, backoffMs });
}

module.exports = { getFileBuffer };