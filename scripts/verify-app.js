/** Quick smoke checks for server modules (run: node scripts/verify-app.js). */
const assert = require('assert');
const { todayStr, addDays, calcStreak, calcStreakFromDates, hoursUntilCentralMidnight } = require('../lib/central-time');
const { calcStreak: analyticsStreak, sumIncomeAllTime, summarizeUser } = require('../lib/analytics');
const { formatEodChannelMessage } = require('../lib/eod-channel-format');
const { getStreakMilestone, milestoneNotifyKey, streakEmoji } = require('../lib/streak-milestones');
const { detectPersonalBests } = require('../lib/personal-bests');
const { clampSettingsForTier } = require('../lib/tiers');
const { defaultUser } = require('../lib/store');
const {
  qualifiedRank, detectIncomeRecords, prevMonth, sumMonthlyIncome, rankTag, higherRank,
} = require('../lib/income-ranks');
const { detectOnSubmit, applyVerification, displayRank, incomeSummary } = require('../lib/income-verify');

assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/, 'todayStr format');
assert.equal(addDays('2025-06-15', 1), addDays(addDays('2025-06-15', 2), -1), 'addDays roundtrip');

// --- Streak reset-to-0 fix (item 2) -----------------------------------------
const T = todayStr();
const Y = addDays(T, -1);
const YY = addDays(T, -2);
assert.equal(calcStreakFromDates([T, Y, YY]), 3, 'streak counts today back');
assert.equal(calcStreakFromDates([Y, YY]), 2, 'streak HOLDS from yesterday before today submit');
assert.equal(calcStreakFromDates([YY]), 0, 'streak breaks once a full day is missed');
assert.equal(calcStreakFromDates(['2025-06-25', '2025-06-26', '2025-06-27']), 0, 'stale streak is 0');
assert.equal(calcStreakFromDates(['2025-06-25', '2025-06-26', '2025-06-27'], '2025-06-27'), 3, 'streak as-of past date');
assert.equal(analyticsStreak([Y, YY]), calcStreakFromDates([Y, YY]), 'analytics streak matches');

const hLeft = hoursUntilCentralMidnight();
assert.ok(hLeft >= 0 && hLeft <= 24, 'hours until CT midnight in range');

// --- summarizeUser: at-risk + recent-days strip (items 1,2) ------------------
const summary = summarizeUser('user_test', {
  entries: { [Y]: { pairs: [] } },
  visits: [Y],
}, {});
assert.equal(summary.submittedToday, false, 'no EOD today');
assert.equal(summary.atRisk, true, 'at risk when no EOD today');
assert.equal(summary.streak, 1, 'streak still shows yesterday (not reset to 0)');
assert.equal(summary.recentDays.length, 14, 'recent days strip is 14 wide');
assert.equal(summary.recentDays[13].date, T, 'recent days ends today');

const summaryDone = summarizeUser('user_test', {
  entries: { [T]: { pairs: [] } },
  visits: [T],
}, {});
assert.equal(summaryDone.submittedToday, true, 'EOD submitted today');
assert.equal(summaryDone.atRisk, false, 'not at risk when submitted');

// --- Human-readable EOD message (item 8) ------------------------------------
const eod = formatEodChannelMessage({
  entry: {
    pairs: [{ action: 'Call', actionCount: 5, actionTarget: 5, kpi: 'Lead', kpiCount: 2, kpiTarget: 2, actionPlural: true, kpiPlural: true, kpiVerb: 'were reached' }],
    reflection: 'Good day',
    publish: false,
    incomeStreams: [{ name: 'Sales', sales: 1, income: 100 }],
  },
  date: '2025-06-27',
  username: 'tester',
  isPro: true,
  streak: 5,
});
assert.ok(eod.includes('@tester is on fire today'), 'opener when targets met');
assert.ok(eod.includes('5/5 Call(s) were completed'), 'pluralized action segment with target');
assert.ok(eod.includes('2/2 Lead(s) were reached'), 'kpi verb + plural');
assert.ok(eod.includes('They made 1 sale today and $100 in income'), 'money line');
assert.ok(eod.includes('5-day streak 🌱'), 'streak line with tiered emoji');
assert.ok(eod.includes('Reflection: Good day'), 'reflection line');

// Streak emoji tiers
assert.equal(streakEmoji(5), '🌱', 'seedling under 30');
assert.equal(streakEmoji(30), '🔥', 'fire at 30');
assert.equal(streakEmoji(90), '🌋', 'volcano at 90');
assert.equal(streakEmoji(180), '☄️', 'comet at 180');
assert.equal(streakEmoji(365), '🗿', 'statue at 365');

// Inline personal-best annotation (no separate PB message)
const eodPB = formatEodChannelMessage({
  entry: { pairs: [{ action: 'Call', actionCount: 9, kpi: 'Lead', kpiCount: 1 }], publish: false, incomeStreams: [{ name: 'Sales', sales: 3, income: 500 }] },
  date: '2025-06-27', username: 'tester', isPro: true, streak: 2,
  records: [{ type: 'action', name: 'Call' }, { type: 'income', name: 'Sales' }],
});
assert.ok(eodPB.includes('Call') && eodPB.includes('(new best)'), 'inline (new best) annotation present');

const showedUp = formatEodChannelMessage({
  entry: { pairs: [{ action: 'Call', actionCount: 0, kpi: 'Lead', kpiCount: 0 }], publish: false },
  date: '2025-06-27', username: 'tester', isPro: false,
});
assert.ok(showedUp.includes('@tester showed up today'), 'zero-actions fallback opener');

const ranked = formatEodChannelMessage({
  entry: { pairs: [{ action: 'Call', actionCount: 1 }], publish: false },
  date: '2025-06-27', username: 'tester', isPro: true, rank: 'earner',
});
assert.ok(ranked.includes('[Earner · $10K/mo]'), 'inline rank tag in EOD post');

assert.equal(milestoneNotifyKey(getStreakMilestone(1), '2026-06-25'), '1@2026-06-25', 'milestone notify key');

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

// --- Income ranks: 2-consecutive-month rule (items 4,5) ---------------------
const thisMonth = T.slice(0, 7);
const lastMonth = prevMonth(thisMonth);
const rankEntries = {
  [`${lastMonth}-15`]: { incomeStreams: [{ income: 12000 }] },
  [`${thisMonth}-10`]: { incomeStreams: [{ income: 11000 }] },
};
assert.equal(qualifiedRank(rankEntries, thisMonth), 'earner', 'two months >= $10k earns Earner');
assert.equal(sumMonthlyIncome(rankEntries, thisMonth), 11000, 'MTD income sum');
assert.equal(qualifiedRank({ [`${thisMonth}-10`]: { incomeStreams: [{ income: 60000 }] } }, thisMonth), null, 'one month = no rank yet');
assert.equal(rankTag('earner'), '$10K/mo', 'rank tag label');
assert.equal(higherRank('earner', 'starter'), 'earner', 'higherRank picks top tier');

const detNoOptIn = detectIncomeRecords({ entries: rankEntries, date: `${thisMonth}-10`, granted: {}, broadcastTotalMilestones: false });
assert.equal(detNoOptIn.rank, 'earner', 'detect rank record');
assert.equal(detNoOptIn.monthlyMilestone, 10000, 'detect monthly milestone');
assert.equal(detNoOptIn.totalMilestone, null, 'total milestone suppressed when not opted in');
const detOptIn = detectIncomeRecords({ entries: rankEntries, date: `${thisMonth}-10`, granted: {}, broadcastTotalMilestones: true });
assert.equal(detOptIn.totalMilestone, 10000, 'total milestone when opted in (all-time $23k → $10k)');

// --- Income verification gate (items 6,7) -----------------------------------
const d1 = detectOnSubmit({}, { entries: rankEntries, date: `${thisMonth}-10`, broadcastTotalMilestones: true });
assert.equal(d1.changed, true, 'submit detects new record');
assert.equal(d1.patch.incomeVerified, false, 'new record HOLDS verification');
assert.ok(d1.patch.incomePending, 'pending stored');

const pendingRec = { ...d1.patch };
const ver = applyVerification(pendingRec, { username: 'tester' });
assert.equal(ver.patch.incomeVerified, true, 'verify sets flag');
assert.equal(ver.patch.incomePending, null, 'verify clears pending');
assert.equal(ver.patch.incomeGrantedRank, 'earner', 'verify grants rank');
assert.ok(ver.broadcasts.length >= 2, 'verify produces broadcasts');

const grantedRec = { ...pendingRec, ...ver.patch };
assert.equal(displayRank(grantedRec), 'earner', 'display rank after grant');
const d2 = detectOnSubmit(grantedRec, { entries: rankEntries, date: `${thisMonth}-10`, broadcastTotalMilestones: true });
assert.equal(d2.changed, false, 'no new record once granted');
assert.equal(displayRank({ incomeGrantedRank: 'earner', incomeRankOverride: 'mogul' }), 'mogul', 'override wins');
assert.equal(incomeSummary(grantedRec).rankTag, '$10K/mo', 'income summary tag');

const settings = clampSettingsForTier({ pairCount: 2 }, 'basic');
assert.equal(settings.streakNotifications, true, 'streak notifications default on');
assert.equal(settings.pairCount, 1, 'basic clamps pairs');

const user = { ...defaultUser(), streakMilestoneNotifiedKeys: ['7@2025-06-27'] };
assert.deepEqual(user.streakMilestoneNotifiedKeys, ['7@2025-06-27'], 'milestone keys on user');

console.log('verify-app: all checks passed');
