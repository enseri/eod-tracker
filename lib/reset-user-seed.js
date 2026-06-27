const { readStore, writeStore } = require('./store');
const { resolveStorageCompanyIdFromResourceIds } = require('./company-resolve');
const { MEMBER_PROFILES, buildUserRecord } = require('./seed-test-data');

function seedStoreCompanyId() {
  return resolveStorageCompanyIdFromResourceIds({});
}

const PROFILE_ALIASES = {
  marcus: 'seed_test_marcus_chen',
  marcus_chen: 'seed_test_marcus_chen',
  sofia: 'seed_test_sofia_alvarez',
  sofia_alvarez: 'seed_test_sofia_alvarez',
  jordan: 'seed_test_jordan_blake',
  jordan_blake: 'seed_test_jordan_blake',
  priya: 'seed_test_priya_nair',
  priya_nair: 'seed_test_priya_nair',
  eli: 'seed_test_eli_washington',
  eli_washington: 'seed_test_eli_washington',
};

function resolveSeedProfile(profileKey = 'marcus') {
  const key = String(profileKey || 'marcus').trim().toLowerCase();
  const id = PROFILE_ALIASES[key] || (key.startsWith('seed_test_') ? key : `seed_test_${key}`);
  const profile = MEMBER_PROFILES.find((p) => p.id === id);
  if (!profile) {
    const available = MEMBER_PROFILES.map((p) => p.username).join(', ');
    throw new Error(`Unknown seed profile "${profileKey}". Available: ${available}`);
  }
  return profile;
}

function findUserIdByUsername(store, username) {
  const target = String(username || '').trim().toLowerCase();
  if (!target) return null;
  for (const [id, record] of Object.entries(store.users || {})) {
    if ((record.username || '').trim().toLowerCase() === target) return id;
  }
  return null;
}

/**
 * Replace a member's EOD data with a seed profile template, keeping their user id + Whop username.
 */
async function resetUserToSeedProfile({
  username,
  userId,
  profileKey = 'marcus',
  dayCount = 92,
} = {}) {
  const profile = resolveSeedProfile(profileKey);
  const companyId = seedStoreCompanyId();
  const store = await readStore(companyId);

  let targetId = userId || null;
  if (!targetId && username) {
    targetId = findUserIdByUsername(store, username);
  }
  if (!targetId) {
    throw new Error(
      userId
        ? `User id "${userId}" not found in store`
        : `No user found with username "${username}"`,
    );
  }

  const existing = store.users[targetId];
  if (!existing) {
    throw new Error(`User id "${targetId}" not found in store`);
  }

  const keepUsername = existing.username || username || targetId;
  const seedData = buildUserRecord(profile, dayCount);
  const resetRecord = {
    ...seedData,
    username: keepUsername,
    updatedAt: new Date().toISOString(),
  };

  const proUserIds = new Set(store.proUserIds || []);
  if (resetRecord.adminTier === 'pro' || resetRecord.tier === 'pro') {
    proUserIds.add(targetId);
  } else {
    proUserIds.delete(targetId);
  }

  await writeStore(companyId, {
    ...store,
    users: { ...store.users, [targetId]: resetRecord },
    proUserIds: [...proUserIds],
    updatedAt: new Date().toISOString(),
  });

  return {
    userId: targetId,
    username: keepUsername,
    seedProfile: profile.id,
    seedLabel: profile.username,
    tier: resetRecord.tier,
    entryCount: Object.keys(resetRecord.entries || {}).length,
    visitCount: (resetRecord.visits || []).length,
    pairCount: resetRecord.settings?.pairCount || 1,
    incomeStreams: (resetRecord.settings?.incomeStreams || []).length,
  };
}

module.exports = {
  PROFILE_ALIASES,
  resolveSeedProfile,
  findUserIdByUsername,
  resetUserToSeedProfile,
};
