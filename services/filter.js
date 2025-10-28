// services/filter.js
const { db } = require('./firebase');
const { env } = require('../config/env');

function defaultFilter() {
  return {
    ownership: 'all',   // all | owner | shared
    hasGps: 'any',      // any | yes | no
    text: null,         // строка поиска (lowercase)
    periodDays: null    // число дней или null
  };
}

function normalizeFilter(raw = {}) {
  const f = { ...defaultFilter(), ...raw };
  if (!['all', 'owner', 'shared'].includes(f.ownership)) f.ownership = 'all';
  if (!['any', 'yes', 'no'].includes(f.hasGps)) f.hasGps = 'any';
  if (typeof f.text === 'string') {
    f.text = f.text.trim();
    if (!f.text) f.text = null;
  } else {
    f.text = null;
  }
  if (f.periodDays != null) {
    const n = Number(f.periodDays);
    f.periodDays = Number.isFinite(n) && n > 0 ? n : null;
  } else {
    f.periodDays = null;
  }
  return f;
}

async function getUserFilter(userId) {
  const snap = await db.ref(`userFilters/${userId}`).get();
  if (!snap.exists()) return defaultFilter();
  return normalizeFilter(snap.val());
}

async function saveUserFilter(userId, partial) {
  const current = await getUserFilter(userId);
  const next = normalizeFilter({ ...current, ...partial });
  await db.ref(`userFilters/${userId}`).set(next);
  return next;
}

function matchesFilter(spot, role, filter, now = Date.now()) {
  // ownership
  if (filter.ownership === 'owner' && role !== 'owner') return false;
  if (filter.ownership === 'shared' && role !== 'shared') return false;

  // hasGps
  const hasGps = spot?.coordinates && typeof spot.coordinates.lat === 'number' && typeof spot.coordinates.lon === 'number';
  if (filter.hasGps === 'yes' && !hasGps) return false;
  if (filter.hasGps === 'no' && hasGps) return false;

  // period
  if (filter.periodDays) {
    const created = Number(spot?.createdAt || 0);
    const fromTs = now - filter.periodDays * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(created) || created < fromTs) return false;
  }

  // text search (title, description, city, region, possible usernames)
  if (filter.text) {
    const hay = [
      spot?.title,
      spot?.description,
      spot?.city,
      spot?.region,
      spot?.country,
      spot?.username,
      spot?.ownerUsername,
      spot?.createdByUsername,
      spot?.owner?.username
    ]
      .filter(Boolean)
      .join('\n')
      .toLowerCase();
    if (!hay.includes(String(filter.text).toLowerCase())) return false;
  }

  return true;
}

function summarizeFilter(filter) {
  const parts = [];
  if (filter.ownership === 'owner') parts.push('мои');
  else if (filter.ownership === 'shared') parts.push('мне расшарили');
  if (filter.hasGps === 'yes') parts.push('с координатами');
  else if (filter.hasGps === 'no') parts.push('без координат');
  if (filter.periodDays) parts.push(`за ${filter.periodDays} дн.`);
  if (filter.text) parts.push(`поиск: “${filter.text}”`);
  return parts.length ? parts.join(' · ') : 'без фильтров';
}

async function find(userId, { offset = 0, limit = env.PAGINATION.pageSize } = {}) {
  const filter = await getUserFilter(userId);

  // userSpots => { spotId: 'owner'|'shared' }
  const mapSnap = await db.ref(`userSpots/${userId}`).get();
  if (!mapSnap.exists()) {
    return { items: [], total: 0, baseTotal: 0, offset: 0, nextOffset: null, prevOffset: null, filter };
  }
  const roleMap = mapSnap.val(); // {id: role}

  // fetch spots
  const ids = Object.keys(roleMap);
  const snaps = await Promise.all(ids.map(id => db.ref(`spots/${id}`).get()));
  const itemsAll = snaps
    .filter(s => s.exists())
    .map(s => {
      const spot = s.val();
      return {
        id: s.key,
        role: roleMap[s.key] || 'shared',
        ...spot
      };
    });

  const baseTotal = itemsAll.length;

  // filter
  const now = Date.now();
  const filtered = itemsAll.filter(s => matchesFilter(s, s.role, filter, now));

  // sort by createdAt desc
  filtered.sort((a, b) => (Number(b.createdAt || 0) - Number(a.createdAt || 0)));

  const total = filtered.length;
  const from = Math.max(0, Number(offset) || 0);
  const to = Math.min(total, from + limit);
  const page = filtered.slice(from, to);

  const prevOffset = from > 0 ? Math.max(0, from - limit) : null;
  const nextOffset = to < total ? to : null;

  return {
    items: page,
    total,
    baseTotal,
    offset: from,
    prevOffset,
    nextOffset,
    filter,
    from: from + 1,
    to
  };
}

module.exports = {
  defaultFilter,
  normalizeFilter,
  getUserFilter,
  saveUserFilter,
  summarizeFilter,
  find
};