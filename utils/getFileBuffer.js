async function getFileBuffer(ctx, file) {
    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const response = await fetch(fileLink.href);
    return Buffer.from(await response.arrayBuffer());
  }

module.exports = {getFileBuffer}