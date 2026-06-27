#!/usr/bin/env node
/**
 * Test bulk delete: seeds 3 disposable users, deletes all 3 in one API call, verifies removal.
 *
 * Usage:
 *   npm run test:bulk-delete
 *   npm run test:bulk-delete:api
 */

const { BULK_TEST_IDS } = require('../lib/seed-test-data');

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const apiIdx = args.indexOf('--api');
const API_BASE = apiIdx >= 0 ? args[apiIdx + 1]?.replace(/\/$/, '') : null;

async function testLocal() {
  const store = require('../lib/store');
  const { seedBulkTestUsers } = require('../lib/seed-test-apply');
  const { resolveStorageCompanyIdFromResourceIds } = require('../lib/company-resolve');
  const companyId = resolveStorageCompanyIdFromResourceIds({});

  console.log('=== Local store bulk delete test ===');
  console.log('Storage:', store.storageMode(), 'company:', companyId);

  await seedBulkTestUsers();
  let s = await store.readStore(companyId);
  const before = BULK_TEST_IDS.filter((id) => s.users[id]);
  console.log(`Seeded ${before.length} bulk test users`);

  const t0 = Date.now();
  const result = await store.deleteUsers(companyId, BULK_TEST_IDS);
  const ms = Date.now() - t0;
  console.log(`deleteUsers returned in ${ms}ms:`, result);

  s = await store.readStore(companyId);
  const remaining = BULK_TEST_IDS.filter((id) => s.users[id]);
  if (remaining.length) {
    console.error('FAIL — still present:', remaining);
    process.exit(1);
  }
  console.log('PASS — all bulk test users removed in one operation');
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function testApi(base) {
  console.log(`=== API bulk delete test (${base}) ===`);

  const seed = await fetchJson(`${base}/api/admin/seed?admin=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'bulk-test' }),
  });
  if (!seed.ok) {
    console.error('Seed bulk-test users failed:', seed.data);
    process.exit(1);
  }
  console.log('Seeded bulk-test users:', seed.data.userIds);

  const t0 = Date.now();
  const del = await fetchJson(`${base}/api/admin/users?admin=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', userIds: BULK_TEST_IDS }),
  });
  const ms = Date.now() - t0;
  console.log(`POST delete (${ms}ms):`, del.status, del.data);

  if (!del.ok) {
    console.error('FAIL — bulk delete request failed');
    process.exit(1);
  }

  const listAfter = await fetchJson(`${base}/api/admin/users?admin=1&_=${Date.now()}`);
  const remaining = BULK_TEST_IDS.filter((id) =>
    (listAfter.data.users || []).some((u) => u.userId === id),
  );

  if (remaining.length) {
    console.error('FAIL — users still in admin list:', remaining);
    process.exit(1);
  }

  if (del.data.deleted !== BULK_TEST_IDS.length) {
    console.error(`FAIL — API reported deleted=${del.data.deleted}, expected ${BULK_TEST_IDS.length}`);
    process.exit(1);
  }

  console.log(`PASS — ${BULK_TEST_IDS.length} users deleted in ${ms}ms`);
}

async function main() {
  if (LOCAL) {
    await testLocal();
    return;
  }
  if (API_BASE) {
    await testApi(API_BASE);
    return;
  }
  console.log('Usage:\n  node scripts/test-bulk-delete.js --local\n  node scripts/test-bulk-delete.js --api https://eod-tracker-ecru.vercel.app');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
