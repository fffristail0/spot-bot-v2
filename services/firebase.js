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

async function addSpot(spot) {
  await db.ref('spots').push(spot);
}

async function getSpots(userId = null) {
  const snapshot = await db.ref('spots').get();
  if (!snapshot.exists()) return [];

  const allSpots = Object.values(snapshot.val());
  return userId ? allSpots.filter(s => s.userId === userId) : allSpots;
}

module.exports = { addSpot, getSpots, db };
