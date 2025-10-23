const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3 = new S3Client({
    region: 'ru-central1',
    endpoint: process.env.YANDEX_ENDPOINT,
    credentials: {
        accessKeyId: process.env.YANDEX_ACCESS_KEY,
        secretAccessKey: process.env.YANDEX_SECRET_KEY,
    },
});

async function uploadFile(key, buffer) {
    const command = new PutObjectCommand({
        Bucket: process.env.YANDEX_BUCKET,
        Key: key,
        Body: buffer,
    });
    await s3.send(command);
    // возвращаем публичный URL
    return `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET}/${key}`;
}

module.exports = { uploadFile };