const admin = require('firebase-admin');
const serviceAccount = require('../firebase-key.json');
require('dotenv').config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}

const db = admin.database();

// Добавление спота. Устанавливаем ownerId = userId (для обратной совместимости)
async function addSpot(spot) {
  const ref = await db.ref('spots').push(spot);
  const key = ref.key;
  // записать mapping в userSpots: owner
  try {
    await db.ref(`userSpots/${spot.userId}/${key}`).set('owner');
  } catch (e) {
    console.error('Failed to write userSpots mapping', e);
  }
  return key;
}

// Получить все споты, которые доступны пользователю: свои + sharedWith
async function getSpots(userId = null) {
  const snapshot = await db.ref('spots').get();
  if (!snapshot.exists()) return [];

  const allSpotsObj = snapshot.val(); // { spotId: spot }
  const allSpots = Object.entries(allSpotsObj).map(([id, spot]) => ({ id, ...spot }));

  if (!userId) return allSpots;

  // Фильтруем: либо владелец, либо sharedWith включает userId
  const res = allSpots.filter(s => {
    if (s.userId === userId) return true;
    if (s.sharedWith && typeof s.sharedWith === 'object') {
      // sharedWith stored as { "<userId>": { timestamp } }
      return Object.prototype.hasOwnProperty.call(s.sharedWith, String(userId));
    }
    return false;
  });
  return res;
}

// ✅ Получить ВСЕ споты без фильтрации
async function getAllSpots() {
  const snapshot = await db.ref('spots').get();
  if (!snapshot.exists()) return {};
  return snapshot.val();
}

// Создать шеринг: добавить в spots/{spotId}/sharedWith/{targetUserId} и в userSpots/{targetUserId}/{spotId}='shared'
async function shareSpot(spotId, fromUserId, targetUserId) {
  const spotRef = db.ref(`spots/${spotId}`);
  const snap = await spotRef.get();
  if (!snap.exists()) throw new Error('Spot not found');

  const spot = snap.val();
  const ownerId = String(spot.ownerId || spot.userId);
  const fromId = String(fromUserId);

  const isOwner = fromId === ownerId;
  const isEditor =
    spot.sharedWith &&
    spot.sharedWith[fromId] &&
    spot.sharedWith[fromId].role === 'editor';

  // ✅ Разрешаем делиться owner'у и editor'у
  if (!isOwner && !isEditor) {
    throw new Error('You have no rights to share this spot');
  }  

  const updates = {};
  updates[`spots/${spotId}/sharedWith/${targetUserId}`] = {
    timestamp: Date.now(),
    sharedBy: fromUserId,
    role: 'shared' // базовая роль
  };
  updates[`userSpots/${targetUserId}/${spotId}`] = 'shared';

  await db.ref().update(updates);
  return true;
}

// Проверить, sharedWith содержит user
async function isSharedWith(spotId, userId) {
  const snap = await db.ref(`spots/${spotId}/sharedWith/${userId}`).get();
  return snap.exists();
}

// Удалить шеринг (для отмены)
async function unshareSpot(spotId, fromUserId, targetUserId) {
  const spotRef = db.ref(`spots/${spotId}`);
  const snap = await spotRef.get();
  if (!snap.exists()) throw new Error('Spot not found');
  const spot = snap.val();
  if (String(spot.userId) !== String(fromUserId) && String(spot.ownerId || spot.userId) !== String(fromUserId)) {
    throw new Error('Only owner can unshare this spot');
  }
  const updates = {};
  updates[`spots/${spotId}/sharedWith/${targetUserId}`] = null;
  updates[`userSpots/${targetUserId}/${spotId}`] = null;
  await db.ref().update(updates);
  return true;
}

module.exports = {
  addSpot,
  getSpots,
  getAllSpots,
  db,
  shareSpot,
  isSharedWith,
  unshareSpot
};
