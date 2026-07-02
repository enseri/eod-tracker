/** Quick smoke checks for server modules (run: node scripts/verify-app.js). */
const assert = require('assert');
const { todayStr, addDays, calcStreak, calcStreakFromDates, hoursUntilCentralMidnight } = require('../lib/central-time');
const { calcStreak: analyticsStreak, sumIncomeAllTime, summarizeUser } = require('../lib/analytics');
const { formatEodChannelMessage } = require('../lib/eod-channel-format');
const { getStreakMilestone } = require('../lib/streak-milestones');
const { detectPersonalBests } = require('../lib/personal-bests');
const { clampSettingsForTier } = require('../lib/tiers');
const { defaultUser } = require('../lib/store');

assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/, 'todayStr format');
assert.equal(addDays('2025-06-15', 1), addDays(addDays('2025-06-15', 2), -1), 'addDays roundtrip');

const visits = ['2025-06-25', '2025-06-26', '2025-06-27'];
assert.equal(calcStreakFromDates(visits, '2025-06-27'), 3, 'central streak');
assert.equal(analyticsStreak(visits), calcStreakFromDates(visits), 'analytics streak matches');

const hLeft = hoursUntilCentralMidnight();
assert.ok(hLeft >= 0 && hLeft <= 24, 'hours until CT midnight in range');

const summary = summarizeUser('user_test', {
  entries: { '2025-06-26': { pairs: [] } },
  visits: ['2025-06-26'],
}, {});
assert.equal(summary.submittedToday, false, 'no EOD today');
assert.equal(summary.atRisk, true, 'at risk when no EOD today');
assert.ok(typeof summary.hoursUntilReset === 'number', 'hours until reset');

const summaryDone = summarizeUser('user_test', {
  entries: { [todayStr()]: { pairs: [] } },
  visits: [todayStr()],
}, {});
assert.equal(summaryDone.submittedToday, true, 'EOD submitted today');
assert.equal(summaryDone.atRisk, false, 'not at risk when submitted');

const eod = formatEodChannelMessage({
  entry: {
    pairs: [{ action: 'Calls', actionCount: 5, kpi: 'Leads', kpiCount: 2 }],
    reflection: 'Good day',
    publish: false,
    incomeStreams: [{ name: 'Sales', sales: 1, income: 100 }],
  },
  date: '2025-06-27',
  username: 'tester',
  streak: 7,
  isPro: true,
});
assert.ok(eod.includes('Current streak: 7'), 'EOD includes streak count');
assert.ok(!eod.includes(getStreakMilestone(7).message), 'EOD excludes milestone celebration text');

const entries = {
  '2025-06-01': { incomeStreams: [{ income: 50 }] },
  '2025-06-27': { incomeStreams: [{ income: 100 }] },
};
assert.equal(sumIncomeAllTime(entries), 150, 'all-time income');

const prev = { pairs: [{ action: 'Calls', actionCount: 10, kpi: 'X', kpiCount: 1 }] };
const next = { pairs: [{ action: 'Calls', actionCount: 15, kpi: 'X', kpiCount: 1 }] };
const all = { '2025-06-01': { pairs: [{ action: 'Calls', actionCount: 5, kpi: 'X', kpiCount: 1 }] }, '2025-06-27': next };
const pbs = detectPersonalBests({ entry: next, entries: all, date: '2025-06-27', isPro: false, previousEntry: prev });
assert.ok(pbs.some((r) => r.type === 'action'), 'override PB detects action record');

const settings = clampSettingsForTier({ pairCount: 2 }, 'basic');
assert.equal(settings.streakNotifications, true, 'streak notifications default on');
assert.equal(settings.pairCount, 1, 'basic clamps pairs');

const user = { ...defaultUser(), streakMilestoneNotifiedKeys: ['7@2025-06-27'] };
assert.deepEqual(user.streakMilestoneNotifiedKeys, ['7@2025-06-27'], 'milestone keys on user');

console.log('verify-app: all checks passed');
