// services/spotMeta.js
const { db } = require('../services/firebase');

async function attachTgFileId(spotId, tgFileId) {
  if (!spotId || !tgFileId) return;
  try {
    await db.ref(`spots/${spotId}/tgFileId`).set(tgFileId);
  } catch (e) {
    console.warn('attachTgFileId failed:', e.message);
  }
}

module.exports = { attachTgFileId };