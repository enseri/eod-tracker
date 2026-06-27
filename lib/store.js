const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'eod-store.json');
const BLOB_PATH = 'eod-tracker/store.json';
const KV_KEY = 'eod-tracker-store';

let kvClient = null;

function emptyStore() {
  return { users: {}, proUserIds: [], updatedAt: new Date().toISOString() };
}

function defaultUser() {
  return {
    tier: 'basic',
    username: null,
    visits: [],
    entries: {},
    settings: { pairCount: 1, incomeStreams: [], streakNotifications: true },
    options: {},
    createdAt: new Date().toISOString(),
  };
}

function normalizeStore(data) {
  const store = data || emptyStore();
  if (!store.users) store.users = {};
  if (!Array.isArray(store.proUserIds)) store.proUserIds = [];
  return store;
}

function cloneStore(store) {
  return JSON.parse(JSON.stringify(normalizeStore(store)));
}

function storageSlug(companyId) {
  return String(companyId || 'global').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

function blobPathFor(companyId) {
  const slug = storageSlug(companyId);
  if (slug === 'global') return BLOB_PATH;
  return `eod-tracker/companies/${slug}/store.json`;
}

function kvKeyFor(companyId) {
  const slug = storageSlug(companyId);
  if (slug === 'global') return KV_KEY;
  return `${KV_KEY}-${slug}`;
}

function dataFileFor(companyId) {
  const slug = storageSlug(companyId);
  if (slug === 'global') return DATA_FILE;
  return path.join(DATA_DIR, `eod-store-${slug}.json`);
}

function mergeUserRecords(existing, patch) {
  if (!patch) return existing || defaultUser();
  const base = existing || defaultUser();
  const next = {
    ...base,
    ...patch,
    updatedAt: patch.updatedAt || new Date().toISOString(),
  };

  if (patch.entries !== undefined) {
    next.entries = { ...(base.entries || {}), ...patch.entries };
  } else {
    next.entries = base.entries || {};
  }

  if (Array.isArray(patch.deleteEntryDates) && patch.deleteEntryDates.length) {
    patch.deleteEntryDates.forEach((d) => {
      if (d) delete next.entries[d];
    });
  }

  if (patch.visits !== undefined) {
    next.visits = Array.isArray(patch.visits) ? patch.visits : base.visits || [];
  } else {
    next.visits = base.visits || [];
  }

  if (patch.settings !== undefined) {
    next.settings = patch.settings;
  }

  if (patch.options !== undefined) {
    next.options = { ...(base.options || {}), ...patch.options };
  }

  if (patch.adminTier !== undefined) {
    next.adminTier = patch.adminTier;
  } else if (base.adminTier !== undefined) {
    next.adminTier = base.adminTier;
  }

  return next;
}

function mergeUserMaps(baseUsers, patchUsers) {
  const out = { ...(baseUsers || {}) };
  for (const [userId, patch] of Object.entries(patchUsers || {})) {
    out[userId] = mergeUserRecords(out[userId], patch);
  }
  return out;
}

function hasBlobConfig() {
  return !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

async function getKv() {
  if (kvClient !== null) return kvClient;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const { Redis } = await import('@upstash/redis');
      kvClient = new Redis({ url, token });
      return kvClient;
    } catch {
      try {
        const { kv } = await import('@vercel/kv');
        kvClient = kv;
        return kvClient;
      } catch {
        kvClient = false;
        return false;
      }
    }
  }
  kvClient = false;
  return false;
}

async function readBlobAt(pathname, attempt = 0) {
  if (!hasBlobConfig()) return null;
  try {
    const { get } = await import('@vercel/blob');
    const result = await get(pathname, {
      access: 'private',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!result) return null;
    if (result.statusCode === 304) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
        return readBlobAt(pathname, attempt + 1);
      }
      return null;
    }
    if (result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (err) {
    const missing = err?.name === 'BlobNotFoundError' || /not found/i.test(err?.message || '');
    if (missing) return null;
    console.error(`Blob read failed (${pathname}):`, err.message);
    return null;
  }
}

async function writeBlobAt(pathname, data) {
  if (!hasBlobConfig()) return { ok: false, error: 'no blob config' };
  try {
    const { put } = await import('@vercel/blob');
    await put(pathname, JSON.stringify(data), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return { ok: true };
  } catch (err) {
    console.error(`Blob write failed (${pathname}):`, err.message);
    return { ok: false, error: err.message || String(err) };
  }
}

function readFileStore(companyId) {
  const file = dataFileFor(companyId);
  try {
    if (!fs.existsSync(file)) return emptyStore();
    return normalizeStore(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return emptyStore();
  }
}

function writeFileStore(companyId, data) {
  const file = dataFileFor(companyId);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const normalized = normalizeStore({ ...data, updatedAt: new Date().toISOString() });
  fs.writeFileSync(file, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

async function migrateLegacyGlobalIfEmpty(companyId, store) {
  if (Object.keys(store.users || {}).length) return store;
  const slug = storageSlug(companyId);
  if (slug === 'global') return store;

  const legacy = await readBlobAt(BLOB_PATH);
  if (!legacy?.users || !Object.keys(legacy.users).length) return store;

  const { getWhopCompanyId } = require('./whop');
  const envCo = getWhopCompanyId();
  if (envCo && storageSlug(envCo) === slug) {
    console.log(`Migrating legacy global store → ${blobPathFor(companyId)}`);
    return cloneStore(legacy);
  }
  return store;
}

async function readPersistedStore(companyId) {
  const slug = storageSlug(companyId);
  const kv = await getKv();
  if (kv) {
    const data = await kv.get(kvKeyFor(companyId));
    return cloneStore(data || emptyStore());
  }

  if (hasBlobConfig()) {
    let store = cloneStore((await readBlobAt(blobPathFor(companyId))) || emptyStore());
    store = await migrateLegacyGlobalIfEmpty(companyId, store);
    return store;
  }

  if (!process.env.VERCEL) {
    return cloneStore(readFileStore(companyId));
  }

  return emptyStore();
}

async function persistStore(companyId, store) {
  const normalized = normalizeStore({ ...store, updatedAt: new Date().toISOString() });

  const kv = await getKv();
  if (kv) {
    await kv.set(kvKeyFor(companyId), normalized);
    return normalized;
  }

  if (hasBlobConfig()) {
    const result = await writeBlobAt(blobPathFor(companyId), normalized);
    if (!result.ok) {
      const err = new Error(result.error || 'Failed to write to Blob storage');
      err.blobError = result.error;
      throw err;
    }
    return normalized;
  }

  if (!process.env.VERCEL) {
    return writeFileStore(companyId, normalized);
  }

  return normalized;
}

/**
 * Apply a store mutation with read-merge-write retries (safe for concurrent serverless invocations).
 * mutator receives a clone of the latest store and returns:
 *   { userPatches?, proUserIds?, replaceProUserIds? }
 */
async function mutateStore(companyId, mutator, verify) {
  const maxAttempts = 5;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const latest = await readPersistedStore(companyId);
      const delta = await mutator(cloneStore(latest));

      const merged = {
        users: mergeUserMaps(latest.users, delta.userPatches || {}),
        proUserIds: delta.replaceProUserIds
          ? (delta.proUserIds || [])
          : delta.proUserIds !== undefined
            ? [...new Set([...(latest.proUserIds || []), ...delta.proUserIds])]
            : [...(latest.proUserIds || [])],
        updatedAt: new Date().toISOString(),
      };

      if (delta.deleteUserIds?.length) {
        for (const id of delta.deleteUserIds) {
          delete merged.users[id];
          merged.proUserIds = merged.proUserIds.filter((pid) => pid !== id);
        }
      }

      await persistStore(companyId, merged);

      if (verify) {
        const check = await readPersistedStore(companyId);
        const verified = verify(check, merged);
        if (!verified) {
          const localOk = verify(merged, merged);
          if (!localOk) {
            throw new Error('Store verify failed after write');
          }
        }
      }

      return { store: merged, delta };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to save store');
}

async function readStore(companyId) {
  return readPersistedStore(companyId);
}

async function writeStore(companyId, data) {
  await persistStore(companyId, normalizeStore(data));
  return normalizeStore(data);
}

async function getUserRecord(companyId, userId, { createIfMissing } = { createIfMissing: true }) {
  const store = await readStore(companyId);
  if (store.users[userId]) return store.users[userId];
  if (!createIfMissing) return null;

  const created = await updateUser(companyId, userId, defaultUser());
  return created || defaultUser();
}

async function patchUserFields(companyId, userPatches) {
  if (!userPatches || !Object.keys(userPatches).length) return;
  await mutateStore(companyId, () => ({ userPatches }));
}

async function updateUser(companyId, userId, patch) {
  const stamped = { ...patch, updatedAt: new Date().toISOString() };
  const expectedKeys = patch.entries ? Object.keys(patch.entries) : null;
  const deletedDates = Array.isArray(patch.deleteEntryDates)
    ? patch.deleteEntryDates.filter(Boolean)
    : [];

  const { store } = await mutateStore(
    companyId,
    () => ({
      userPatches: { [userId]: stamped },
    }),
    (check) => {
      const record = check.users?.[userId];
      if (!record) return false;
      if (deletedDates.length) {
        return deletedDates.every((d) => !record.entries?.[d]);
      }
      if (!expectedKeys?.length) return true;
      return expectedKeys.every((d) => record.entries?.[d]);
    },
  );
  return store.users[userId] || mergeUserRecords(defaultUser(), stamped);
}

async function listUsers(companyId) {
  const store = await readStore(companyId);
  return store.users;
}

async function setAdminTier(companyId, userId, tier) {
  if (tier !== 'basic' && tier !== 'pro') {
    throw Object.assign(new Error('tier must be basic or pro'), { status: 400 });
  }

  const { store } = await mutateStore(
    companyId,
    (latest) => {
      const proUserIds = Array.isArray(latest.proUserIds) ? [...latest.proUserIds] : [];
      if (tier === 'pro') {
        if (!proUserIds.includes(userId)) proUserIds.push(userId);
      } else {
        const idx = proUserIds.indexOf(userId);
        if (idx >= 0) proUserIds.splice(idx, 1);
      }

      return {
        userPatches: {
          [userId]: {
            tier,
            adminTier: tier,
            tierSetAt: new Date().toISOString(),
          },
        },
        proUserIds,
        replaceProUserIds: true,
      };
    },
    (check) => {
      const u = check.users?.[userId];
      if (!u || u.adminTier !== tier || u.tier !== tier) return false;
      const onList = (check.proUserIds || []).includes(userId);
      return tier === 'pro' ? onList : !onList;
    },
  );

  return {
    user: store.users[userId],
    proUserIds: store.proUserIds,
    store,
  };
}

async function deleteUsers(companyId, userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return { ok: true, deleted: 0, userIds: [] };

  const { store } = await mutateStore(companyId, () => ({
    deleteUserIds: ids,
  }));

  const remaining = ids.filter((id) => store.users[id]);
  if (remaining.length) {
    const err = new Error(`Failed to delete ${remaining.length} member(s) from store`);
    err.status = 500;
    err.remaining = remaining;
    throw err;
  }
  return { ok: true, deleted: ids.length, userIds: ids };
}

async function deleteUser(companyId, userId) {
  return deleteUsers(companyId, [userId]);
}

async function isUserPro(companyId, userId) {
  const store = await readStore(companyId);
  const record = store.users[userId];
  if (record?.adminTier === 'pro') return true;
  if (record?.adminTier === 'basic') return false;
  return (store.proUserIds || []).includes(userId);
}

function storageMode() {
  if (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) return 'redis';
  if (hasBlobConfig()) return 'blob';
  if (!process.env.VERCEL) return 'file';
  return 'memory';
}

module.exports = {
  readStore,
  writeStore,
  getUserRecord,
  updateUser,
  patchUserFields,
  listUsers,
  setAdminTier,
  deleteUser,
  deleteUsers,
  isUserPro,
  storageMode,
  hasBlobConfig,
  emptyStore,
  defaultUser,
};
