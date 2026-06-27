const { readStore, writeStore, deleteUsers } = require('./store');
const {
  SEED_PREFIX,
  BULK_TEST_IDS,
  MEMBER_PROFILES,
  BULK_TEST_PROFILES,
  buildUserRecord,
  buildBulkTestUser,
} = require('./seed-test-data');

const { resolveStorageCompanyIdFromResourceIds } = require('./company-resolve');

function seedStoreCompanyId() {
  return resolveStorageCompanyIdFromResourceIds({});
}

async function wipeSeedUsers() {
  const companyId = seedStoreCompanyId();
  const store = await readStore(companyId);
  const ids = Object.keys(store.users || {}).filter((id) => id.startsWith(SEED_PREFIX));
  if (!ids.length) return 0;
  await deleteUsers(companyId, ids);
  return ids.length;
}

async function mergeUsersIntoStore(userPatches) {
  const companyId = seedStoreCompanyId();
  const store = await readStore(companyId);
  const proUserIds = new Set(store.proUserIds || []);

  for (const [id, record] of Object.entries(userPatches)) {
    if (record.adminTier === 'pro' || record.tier === 'pro') proUserIds.add(id);
  }

  const next = {
    ...store,
    users: { ...store.users, ...userPatches },
    proUserIds: [...proUserIds],
    updatedAt: new Date().toISOString(),
  };

  await writeStore(companyId, next);
  return summarizeSeeded(userPatches);
}

function summarizeSeeded(userPatches) {
  return Object.entries(userPatches).map(([id, u]) => ({
    id,
    username: u.username,
    tier: u.tier,
    entries: Object.keys(u.entries || {}).length,
    visits: (u.visits || []).length,
  }));
}

async function seedMemberProfiles({ wipe = false, dayCount = 92 } = {}) {
  if (wipe) await wipeSeedUsers();

  const userPatches = {};
  for (const profile of MEMBER_PROFILES) {
    userPatches[profile.id] = buildUserRecord(profile, dayCount);
  }

  const seeded = await mergeUsersIntoStore(userPatches);
  const store = await readStore(seedStoreCompanyId());
  return { seeded, totalMembers: Object.keys(store.users).length };
}

async function seedBulkTestUsers() {
  const userPatches = {};
  for (const p of BULK_TEST_PROFILES) {
    userPatches[p.id] = buildBulkTestUser(p.id, p.username);
  }
  const seeded = await mergeUsersIntoStore(userPatches);
  return { seeded, userIds: BULK_TEST_IDS };
}

module.exports = {
  wipeSeedUsers,
  seedMemberProfiles,
  seedBulkTestUsers,
  BULK_TEST_IDS,
};
