const admin = require('firebase-admin');
require('dotenv').config();

function initFirebase() {
  if (admin.apps.length) return;
  const databaseURL = process.env.FIREBASE_DB_URL;
  if (!databaseURL) {
    console.error('ENV ERROR: FIREBASE_DB_URL is required');
    process.exit(1);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(json), databaseURL });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL });
  } else {
    try {
      const serviceAccount = require('../firebase-key.json');
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL });
    } catch (e) {
      console.error('No Firebase credentials provided. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_BASE64');
      process.exit(1);
    }
  }
}
initFirebase();

const db = admin.database();
const TS = admin.database.ServerValue.TIMESTAMP;

async function registerUser(userId, username) {
  const uid = String(userId);
  const updates = {
    [`users/${uid}`]: { username: username || null, updatedAt: Date.now() }
  };
  if (username) {
    updates[`usernames/${String(username).toLowerCase()}`] = uid;
  }
  await db.ref().update(updates);
}

async function getUserByUsername(username) {
  if (!username) return null;
  const key = String(username).toLowerCase();
  const idSnap = await db.ref(`usernames/${key}`).get();
  if (!idSnap.exists()) return null;
  const userId = String(idSnap.val());
  const userSnap = await db.ref(`users/${userId}`).get();
  if (!userSnap.exists()) return { userId, username };
  return { userId, ...userSnap.val() };
}

async function addSpot(raw) {
  const owner = String(raw.userId);
  const spot = {
    ...raw,
    userId: owner,
    ownerId: owner,
    createdAt: TS
  };
  const ref = await db.ref('spots').push(spot);
  const key = ref.key;
  const updates = {
    [`userSpots/${owner}/${key}`]: 'owner'
  };
  await db.ref().update(updates);
  return key;
}

async function spotBelongsToUser(spotId, userId) {
  const snap = await db.ref(`userSpots/${String(userId)}/${spotId}`).get();
  return snap.exists() && snap.val() === 'owner';
}

async function getSpots(userId = null) {
  if (!userId) {
    const snapshot = await db.ref('spots').limitToLast(500).get();
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val()).map(([id, spot]) => ({ id, ...spot }));
  }
  const mapSnap = await db.ref(`userSpots/${String(userId)}`).get();
  if (!mapSnap.exists()) return [];
  const ids = Object.keys(mapSnap.val());
  const snaps = await Promise.all(ids.map(id => db.ref(`spots/${id}`).get()));
  return snaps.filter(s => s.exists()).map(s => ({ id: s.key, ...s.val() }));
}

async function shareSpot(spotId, fromUserId, targetUserId) {
  const spotRef = db.ref(`spots/${spotId}`);
  const snap = await spotRef.get();
  if (!snap.exists()) throw new Error('Spot not found');

  const spot = snap.val();
  const ownerId = String(spot.ownerId || spot.userId);
  const fromId = String(fromUserId);
  const toId = String(targetUserId);

  if (toId === ownerId) return true;
  const allowed = fromId === ownerId || (spot.sharedWith?.[fromId]?.role === 'editor');
  if (!allowed) throw new Error('You have no rights to share this spot');

  const updates = {};
  updates[`spots/${spotId}/sharedWith/${toId}`] = spot.sharedWith?.[toId] || {
    timestamp: Date.now(),
    sharedBy: fromId,
    role: 'shared'
  };
  updates[`userSpots/${toId}/${spotId}`] = 'shared';

  await db.ref().update(updates);
  return true;
}

async function createPendingInvite(username, spotId, ownerId) {
  const uname = String(username).toLowerCase();
  const data = {
    spotId,
    ownerId: String(ownerId),
    targetUsername: uname,
    createdAt: Date.now()
  };
  await db.ref(`pendingInvites/byUsername/${uname}/${spotId}`).set(data);
  return true;
}

async function claimPendingInvitesForUser(username, userId) {
  const uname = String(username).toLowerCase();
  const snap = await db.ref(`pendingInvites/byUsername/${uname}`).get();
  if (!snap.exists()) return 0;
  const invites = snap.val();
  let count = 0;
  for (const [spotId, inv] of Object.entries(invites)) {
    try {
      await shareSpot(spotId, inv.ownerId, userId);
      await db.ref(`pendingInvites/byUsername/${uname}/${spotId}`).remove();
      count++;
    } catch (e) {
      console.error('claim invite failed', spotId, e);
    }
  }
  return count;
}

module.exports = {
  db,
  registerUser,
  getUserByUsername,
  spotBelongsToUser,
  addSpot,
  getSpots,
  shareSpot,
  createPendingInvite,
  claimPendingInvitesForUser
};
