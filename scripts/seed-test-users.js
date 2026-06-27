#!/usr/bin/env node
/**
 * Seed realistic Pro test members with ~3 months of EOD history.
 *
 * Usage:
 *   npm run seed
 *   npm run seed -- --wipe
 *   node scripts/seed-test-users.js --api https://eod-tracker-ecru.vercel.app
 *
 * Local file store (default):
 *   node scripts/seed-test-users.js
 *
 * Production (via admin API — works without local Blob OIDC):
 *   node scripts/seed-test-users.js --api https://eod-tracker-ecru.vercel.app --wipe
 */

const args = process.argv.slice(2);
const WIPE = args.includes('--wipe');
const apiIdx = args.indexOf('--api');
const API_BASE = apiIdx >= 0 ? args[apiIdx + 1]?.replace(/\/$/, '') : null;

async function seedViaApi(base) {
  const res = await fetch(`${base}/api/admin/seed?admin=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'members', wipe: WIPE, dayCount: 92 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Seed API failed');
  console.log(`Seeded via ${base}/api/admin/seed`);
  (data.seeded || []).forEach((s) => {
    console.log(`  • ${s.username} (${s.id}) — ${s.entries} EODs, ${s.visits} visits, ${s.tier}`);
  });
  console.log(`Total store members: ${data.totalMembers}`);
}

async function seedLocal() {
  const { storageMode } = require('../lib/store');
  const { seedMemberProfiles } = require('../lib/seed-test-apply');

  const mode = storageMode();
  console.log(`Storage mode: ${mode}`);
  if (mode === 'memory') {
    console.error('No persistent storage. Run locally (file) or use --api for production.');
    process.exit(1);
  }

  const result = await seedMemberProfiles({ wipe: WIPE, dayCount: 92 });
  console.log('\nSeeded members:');
  result.seeded.forEach((s) => {
    console.log(`  • ${s.username} (${s.id}) — ${s.entries} EODs, ${s.visits} visits, ${s.tier}`);
  });
  console.log(`\nTotal store members: ${result.totalMembers}`);
}

async function main() {
  if (API_BASE) {
    await seedViaApi(API_BASE);
    return;
  }
  await seedLocal();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
