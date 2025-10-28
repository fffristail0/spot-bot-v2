// services/firebase.js
const admin = require('firebase-admin');
const { env } = require('../config/env');
const { deleteFileByKey } = require('./s3');

function initFirebase() {
  if (admin.apps.length) return;

  const databaseURL = env.FIREBASE.databaseURL;
  if (!databaseURL) {
    console.error('ENV ERROR: FIREBASE_DB_URL is required');
    process.exit(1);
  }

  // 1) Сервисный аккаунт через base64
  if (env.FIREBASE.serviceAccountBase64) {
    try {
      const json = JSON.parse(Buffer.from(env.FIREBASE.serviceAccountBase64, 'base64').toString('utf8'));
      admin.initializeApp({ credential: admin.credential.cert(json), databaseURL });
      return;
    } catch (e) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_BASE64:', e);
      process.exit(1);
    }
  }

  // 2) GOOGLE_APPLICATION_CREDENTIALS — стандартный путь GCP
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL });
    return;
  }

  // 3) Локальный файл firebase-key.json — для dev
  try {
    const serviceAccount = require('../firebase-key.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL });
  } catch (e) {
    console.error('No Firebase credentials provided. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_BASE64');
    process.exit(1);
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

async function deleteSpotForUser(spotId, userId) {
  userId = String(userId);
  const spotRef = db.ref(`spots/${spotId}`);

  let txResult = null;

  await new Promise((resolve, reject) => {
    spotRef.transaction((spot) => {
      if (!spot) {
        txResult = { notFound: true };
        return spot;
      }

      const ownerId = String(spot.ownerId || spot.userId);
      const sharedWith = { ...(spot.sharedWith || {}) };

      if (userId !== ownerId) {
        if (sharedWith[userId]) {
          delete sharedWith[userId];
          spot.sharedWith = Object.keys(sharedWith).length ? sharedWith : null;
        }
        txResult = { removedFromUser: true };
        return spot;
      }

      const sorted = Object.entries(sharedWith)
        .sort((a, b) => (a[1]?.timestamp || 0) - (b[1]?.timestamp || 0))
        .map(([uid]) => String(uid));

      if (sorted.length === 0) {
        txResult = {
          fullDelete: true,
          photoKey: spot.photoKey || null,
          users: [ownerId, ...Object.keys(sharedWith).map(String)]
        };
        return null;
      }

      const nextOwner = sorted[0];
      delete sharedWith[nextOwner];
      spot.ownerId = nextOwner;
      spot.sharedWith = Object.keys(sharedWith).length ? sharedWith : null;
      txResult = { transferred: true, prevOwner: ownerId, nextOwner };
      return spot;
    }, (error, committed, snapshot) => {
      if (error) return reject(error);
      resolve({ committed, snapshot });
    }, false);
  });

  if (!txResult) return { ok: false, reason: 'noop' };
  if (txResult.notFound) return { ok: false, reason: 'not_found' };

  if (txResult.fullDelete) {
    const updates = {};
    for (const uid of new Set(txResult.users.map(String))) {
      updates[`userSpots/${uid}/${spotId}`] = null;
    }
    if (Object.keys(updates).length) {
      await db.ref().update(updates).catch(e => console.error('userSpots cleanup failed', e));
    }

    if (txResult.photoKey) await deleteFileByKey(txResult.photoKey).catch(() => {});

    return { ok: true, action: 'deleted' };
  }

  if (txResult.transferred) {
    await db.ref().update({
      [`userSpots/${txResult.prevOwner}/${spotId}`]: null,
      [`userSpots/${txResult.nextOwner}/${spotId}`]: 'owner'
    });
    return { ok: true, action: 'transferred', newOwner: txResult.nextOwner };
  }

  if (txResult.removedFromUser) {
    await db.ref(`userSpots/${userId}/${spotId}`).remove().catch(() => {});
    return { ok: true, action: 'removed_from_user' };
  }

  return { ok: false, reason: 'unknown' };
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
  claimPendingInvitesForUser,
  deleteSpotForUser
};