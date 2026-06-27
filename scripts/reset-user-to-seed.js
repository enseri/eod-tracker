#!/usr/bin/env node
/**
 * Reset a member's tracker data to match a seed profile template.
 * Keeps their Whop user id and username; replaces entries, visits, settings, options, tier.
 *
 * Usage:
 *   node scripts/reset-user-to-seed.js sourcanteenbb
 *   node scripts/reset-user-to-seed.js sourcanteenbb --profile marcus
 *   node scripts/reset-user-to-seed.js sourcanteenbb --api https://eod-tracker-ecru.vercel.app
 *
 * Profiles: marcus (default), sofia, jordan, priya, eli
 */

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const flags = process.argv.slice(2);

const username = args[0] || 'sourcanteenbb';
const profileIdx = flags.indexOf('--profile');
const profileKey = profileIdx >= 0 ? flags[profileIdx + 1] : 'marcus';
const apiIdx = flags.indexOf('--api');
const API_BASE = apiIdx >= 0 ? flags[apiIdx + 1]?.replace(/\/$/, '') : null;
const dayIdx = flags.indexOf('--days');
const dayCount = dayIdx >= 0 ? Number(flags[dayIdx + 1]) || 92 : 92;

async function resetViaApi(base) {
  const res = await fetch(`${base}/api/admin/reset-user?admin=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, profile: profileKey, dayCount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Reset API failed');
  return data;
}

async function resetLocal() {
  const { storageMode } = require('../lib/store');
  const { resetUserToSeedProfile } = require('../lib/reset-user-seed');

  const mode = storageMode();
  console.log(`Storage mode: ${mode}`);
  if (mode === 'memory') {
    console.error('No persistent storage. Use --api for production.');
    process.exit(1);
  }

  return resetUserToSeedProfile({ username, profileKey, dayCount });
}

async function main() {
  console.log(`Resetting @${username} → seed profile "${profileKey}" (${dayCount} days)…`);

  const result = API_BASE ? await resetViaApi(API_BASE) : await resetLocal();

  console.log('\nDone:');
  console.log(`  User id:     ${result.userId}`);
  console.log(`  Username:    ${result.username}`);
  console.log(`  Template:    ${result.seedLabel || result.seedProfile}`);
  console.log(`  Tier:        ${result.tier}`);
  console.log(`  EOD entries: ${result.entryCount}`);
  console.log(`  Visits:      ${result.visitCount}`);
  console.log(`  Pairs:       ${result.pairCount}`);
  console.log(`  Income str.: ${result.incomeStreams}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
