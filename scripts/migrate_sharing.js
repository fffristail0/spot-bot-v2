// scripts/migrate_sharing.js
// Run this once (node scripts/migrate_sharing.js) to populate ownerId and userSpots mappings
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-key.json');
require('dotenv').config();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();

async function migrate() {
  const snap = await db.ref('spots').get();
  if (!snap.exists()) {
    console.log('No spots');
    return;
  }
  const spots = snap.val();
  const updates = {};
  for (const [id, spot] of Object.entries(spots)) {
    const ownerId = spot.userId || spot.ownerId;
    if (!spot.ownerId) updates[`spots/${id}/ownerId`] = ownerId;
    updates[`userSpots/${ownerId}/${id}`] = 'owner';
  }
  console.log('Applying updates...');
  await db.ref().update(updates);
  console.log('Migration done.');
}

migrate().catch(e => { console.error(e); process.exit(1); });