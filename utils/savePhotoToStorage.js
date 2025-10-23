const { uploadFile } = require('../services/s3');

async function savePhotoToStorage(fileName, buffer) {
    await uploadFile(fileName, buffer);
    return `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET}/${fileName}`;
  }

module.exports = {savePhotoToStorage}