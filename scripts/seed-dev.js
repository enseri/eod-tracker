#!/usr/bin/env node
/**
 * Seed the LOCAL file store (data/eod-store.json) with rich sample members so
 * the admin panel showcases every feature while you test.
 *
 *   npm run seed:dev      # then: npm run dev  →  open /dashboard/global
 *
 * Streaks deliberately span every emoji tier so you can see them differ:
 *   🌱 <30   🔥 30+   🌋 90+   ☄️ 180+   🗿 365+
 *
 *   kenji    Basic,  5-day streak (🌱), done today
 *   dedriak  Pro,    2-day streak (🌱) but at risk — visited yesterday, not today
 *   lena     Basic,  0 streak, sporadic (red gaps in the 14-day strip)
 *   marcus   Pro,   35-day streak (🔥), verified → Mogul rank
 *   aisha    Pro,   95-day streak (🌋), 2 months of $10K+ → Earner PENDING verify
 *   ravi     Pro,  210-day streak (☄️), done today
 *   nadia    Pro,  400-day streak (🗿), verified → Magnate rank
 *
 * Safe to re-run; overwrites the local file store only.
 */
const fs = require('fs');
const path = require('path');
const { todayStr, addDays } = require('../lib/central-time');
const { monthOf, prevMonth } = require('../lib/income-ranks');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'eod-store.json');

const T = todayStr();
const thisMonth = monthOf(T);
const lastMonth = prevMonth(thisMonth);

function d(offset) { return addDays(T, offset); }
// Contiguous visit dates of length n ending today (drives the streak).
function visitRun(n) { const a = []; for (let i = n - 1; i >= 0; i -= 1) a.push(d(-i)); return a; }
// Contiguous visits of length n ending YESTERDAY (at-risk: streak holds, not done today).
function visitRunYesterday(n) { const a = []; for (let i = n; i >= 1; i -= 1) a.push(d(-i)); return a; }

function pair(action, aCount, aTarget, kpi, kCount, kTarget) {
  return {
    action, actionCount: aCount, actionTarget: aTarget, actionVerb: 'were completed', actionPlural: true,
    kpi, kpiCount: kCount, kpiTarget: kTarget, kpiVerb: 'happened', kpiPlural: true,
  };
}
function entry(pairs, streams, reflection) {
  return { pairs, incomeStreams: streams || [], reflection: reflection || 'Solid work today.', submittedAt: new Date().toISOString(), publish: false };
}
// Entries for the last k days (fills the 14-day strip green for consistent members).
function fillEntries(k, mk) { const e = {}; for (let i = 0; i < k; i += 1) e[d(-i)] = mk(i); return e; }
function proSettings() { return { pairCount: 1, incomeStreams: [{ id: 'default', name: 'Sales and income' }], streakNotifications: true, broadcastIncomeMilestones: false }; }
function basicSettings() { return { pairCount: 1, incomeStreams: [], streakNotifications: true }; }

// kenji — Basic, 5-day streak (🌱), done today.
const kenji = {
  tier: 'basic', username: 'kenji_grind',
  visits: visitRun(5),
  entries: fillEntries(5, () => entry([pair('Applications', 10, 10, 'Replies', 2, 3)])),
  settings: basicSettings(), options: {}, createdAt: new Date().toISOString(),
};

// dedriak — Pro, 2-day streak (🌱) AT RISK (visited yesterday, not today).
const dedriak = {
  tier: 'pro', adminTier: 'pro', username: 'heydedriak',
  visits: visitRunYesterday(2),
  entries: { [d(-1)]: entry([pair('Instagram DM sent', 61, 60, 'WhatsApp members', 8, 50)], [{ name: 'Sales and income', sales: 0, income: 0 }], 'Invite old FB contacts.') },
  settings: proSettings(), options: {}, createdAt: new Date().toISOString(),
};

// lena — Basic, sporadic (red gaps), streak 0.
const lena = {
  tier: 'basic', username: 'lena_starts',
  visits: [d(-9), d(-8), d(-3)],
  entries: { [d(-9)]: entry([pair('Posts', 1, 2, 'Comments', 4, 10)]), [d(-3)]: entry([pair('Posts', 2, 2, 'Comments', 9, 10)]) },
  settings: basicSettings(), options: {}, createdAt: new Date().toISOString(),
};

// marcus — Pro, 35-day streak (🔥), verified Mogul ($2K/mo).
const marcus = {
  tier: 'pro', adminTier: 'pro', username: 'marcus_scale',
  visits: visitRun(35),
  entries: fillEntries(14, () => entry([pair('Outreach', 80, 80, 'Demos', 5, 4)], [{ name: 'Programs', sales: 2, income: 150 }], 'Scaling.')),
  settings: proSettings(), options: {},
  incomeVerified: true, incomeGrantedRank: 'mogul', incomeGrantedMonthlyMilestone: 2000, incomeGrantedTotalMilestone: 25000,
  createdAt: new Date().toISOString(),
};

// aisha — Pro, 95-day streak (🌋), 2 months of $500+ → Earner PENDING verification.
const aishaEntries = fillEntries(6, () => entry([pair('Cold calls', 40, 50, 'Booked calls', 3, 5)], [{ name: 'Coaching', sales: 1, income: 80 }], 'Dialing hard.'));
aishaEntries[d(0)] = entry([pair('Cold calls', 40, 50, 'Booked calls', 3, 5)], [{ name: 'Coaching', sales: 2, income: 200 }], 'Big close.');
aishaEntries[`${lastMonth}-14`] = entry([pair('Cold calls', 55, 50, 'Booked calls', 6, 5)], [{ name: 'Coaching', sales: 4, income: 600 }], 'Big month.');
const aisha = {
  tier: 'pro', adminTier: 'pro', username: 'aisha_builds',
  visits: visitRun(95), entries: aishaEntries, settings: proSettings(), options: {},
  incomeVerified: false,
  incomePending: { totalMilestone: 1000, monthlyMilestone: 500, rank: 'earner', month: thisMonth, detectedAt: new Date().toISOString() },
  createdAt: new Date().toISOString(),
};

// ravi — Pro, 210-day streak (☄️), done today, Heavyweight ($1K/mo).
const ravi = {
  tier: 'pro', adminTier: 'pro', username: 'ravi_flow',
  visits: visitRun(210),
  entries: fillEntries(14, () => entry([pair('Content posted', 3, 3, 'New leads', 12, 10)], [{ name: 'Consulting', sales: 2, income: 80 }], 'Compounding.')),
  settings: proSettings(), options: {},
  incomeVerified: true, incomeGrantedRank: 'heavyweight', incomeGrantedMonthlyMilestone: 1000,
  createdAt: new Date().toISOString(),
};

// nadia — Pro, 400-day streak (🗿), verified Empire (top rank, $5K/mo).
const nadia = {
  tier: 'pro', adminTier: 'pro', username: 'nadia_reign',
  visits: visitRun(400),
  entries: fillEntries(14, () => entry([pair('Enterprise calls', 6, 5, 'Deals moved', 2, 2)], [{ name: 'Retainers', sales: 3, income: 400 }], 'Empire mode.')),
  settings: proSettings(), options: {},
  incomeVerified: true, incomeGrantedRank: 'empire', incomeGrantedMonthlyMilestone: 5000, incomeGrantedTotalMilestone: 100000,
  createdAt: new Date().toISOString(),
};

const store = {
  users: {
    user_kenji: kenji,
    user_dedriak: dedriak,
    user_lena: lena,
    user_marcus: marcus,
    user_aisha: aisha,
    user_ravi: ravi,
    user_nadia: nadia,
  },
  proUserIds: ['user_dedriak', 'user_marcus', 'user_aisha', 'user_ravi', 'user_nadia'],
  updatedAt: new Date().toISOString(),
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
console.log(`Seeded ${Object.keys(store.users).length} members (streaks 5/2/0/35/95/210/400) → ${path.relative(process.cwd(), FILE)}`);
console.log('Now run:  npm run dev   → open http://localhost:3000/dashboard/global');
