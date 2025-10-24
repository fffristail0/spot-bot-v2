const { Readable } = require('stream');

async function getFileBuffer(ctx, file, { maxBytes = 20 * 1024 * 1024, timeoutMs = 15000 } = {}) {
  const url = await ctx.telegram.getFileLink(file.file_id);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
    const contentType = res.headers.get('content-type') || file.mime_type || 'application/octet-stream';
    const declaredLen = Number(res.headers.get('content-length') || 0);
    if (declaredLen && declaredLen > maxBytes) {
      throw new Error(`File too large: ${declaredLen} bytes`);
    }

    let body = res.body;
    if (body && typeof body.getReader === 'function') {
      body = Readable.fromWeb(body);
    }
    const chunks = [];
    let total = 0;
    for await (const chunk of body) {
      total += chunk.length;
      if (total > maxBytes) {
        throw new Error(`File too large while reading: > ${maxBytes}`);
      }
      chunks.push(chunk);
    }
    return { buffer: Buffer.concat(chunks, total), contentType };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { getFileBuffer };
