const { todayStr, addDays, calcStreakFromDates, hoursUntilCentralMidnight } = require('./central-time');

function calcStreak(visits) {
  return calcStreakFromDates(visits || []);
}

function countMissedDays(entries, visits, days = 7) {
  const today = todayStr();
  const entryDates = Object.keys(entries || {});
  const trackingDates = [...entryDates, ...(visits || [])].filter(Boolean).sort();
  if (!trackingDates.length) return 0;

  const windowStart = addDays(today, -(days - 1));
  const memberStart = trackingDates[0];
  const start = memberStart > windowStart ? memberStart : windowStart;

  let missed = 0;
  let cur = start;
  while (cur <= today) {
    if (!entries?.[cur]) missed += 1;
    if (cur === today) break;
    cur = addDays(cur, 1);
  }
  return missed;
}

function lastEntryDate(entries) {
  const dates = Object.keys(entries || {}).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

function sumIncome(entries, days = 30) {
  const today = todayStr();
  let total = 0;
  for (let i = 0; i < days; i += 1) {
    const ds = addDays(today, -i);
    const entry = entries?.[ds];
    if (!entry?.incomeStreams) continue;
    entry.incomeStreams.forEach((s) => {
      total += Number(s.income || 0);
    });
  }
  return total;
}

function sumIncomeAllTime(entries) {
  let total = 0;
  Object.keys(entries || {}).forEach((ds) => {
    const entry = entries[ds];
    if (!entry?.incomeStreams) return;
    entry.incomeStreams.forEach((s) => {
      total += Number(s.income || 0);
    });
  });
  return total;
}

const { resolveTierFromContext } = require('./tier-resolve');
const { isStaleUsername } = require('./whop-username-sync');
const { sumMonthlyIncome } = require('./income-ranks');
const { incomeSummary } = require('./income-verify');

/**
 * Flags for the last `days` calendar days (US Central), newest last — powers the
 * admin at-a-glance dot strip. `tracked:false` = before this member started, so
 * the admin doesn't read pre-signup blanks as missed days.
 */
function recentDayFlags(entries, visits, days = 14) {
  const today = todayStr();
  const entryDates = new Set(Object.keys(entries || {}));
  const trackingDates = [...entryDates, ...(visits || [])].filter(Boolean).sort();
  const memberStart = trackingDates[0] || today;
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const ds = addDays(today, -i);
    out.push({ date: ds, submitted: entryDates.has(ds), tracked: ds >= memberStart });
  }
  return out;
}

function summarizeUser(userId, record, store) {
  const entries = record.entries || {};
  const visits = record.visits || [];
  const entryDates = Object.keys(entries);
  const last = lastEntryDate(entries);
  const today = todayStr();
  const activeToday = !!entries[today];
  const submittedToday = activeToday;
  const hoursUntilReset = hoursUntilCentralMidnight();
  const tier = resolveTierFromContext(userId, record, store, {});
  const currentMonth = today.slice(0, 7);
  const income = incomeSummary(record);

  return {
    userId,
    username: isStaleUsername(record.username, userId) ? userId : record.username,
    tier,
    adminTier: record.adminTier || null,
    onProList: tier === 'pro',
    streak: calcStreak(visits),
    visitStreak: calcStreak(visits),
    totalEntries: entryDates.length,
    lastEntryDate: last,
    activeToday,
    submittedToday,
    hoursUntilReset,
    atRisk: !submittedToday,
    missedLast7: countMissedDays(entries, visits, 7),
    recentDays: recentDayFlags(entries, visits, 14),
    incomeLast30: sumIncome(entries, 30),
    incomeThisMonth: sumMonthlyIncome(entries, currentMonth),
    incomeAllTime: sumIncomeAllTime(entries),
    // Income verification + rank (items 5–7)
    incomeVerified: income.incomeVerified,
    incomePending: income.incomePending,
    rank: income.rank,
    rankLabel: income.rankLabel,
    rankColor: income.rankColor,
    rankTag: income.rankTag,
    rankOverridden: income.rankOverridden,
    updatedAt: record.updatedAt || record.createdAt || null,
  };
}

function summarizeAll(users, store) {
  const rows = Object.entries(users || {}).map(([userId, record]) => summarizeUser(userId, record, store));
  const activeToday = rows.filter((r) => r.activeToday).length;
  const avgStreak = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.streak, 0) / rows.length)
    : 0;
  const missedLast7 = rows.reduce((sum, r) => sum + r.missedLast7, 0);

  return {
    totals: {
      members: rows.length,
      activeToday,
      avgStreak,
      missedLast7,
      proMembers: rows.filter((r) => r.tier === 'pro').length,
    },
    users: rows.sort((a, b) => {
      if (a.activeToday !== b.activeToday) return a.activeToday ? -1 : 1;
      if (a.lastEntryDate !== b.lastEntryDate) return (b.lastEntryDate || '').localeCompare(a.lastEntryDate || '');
      return b.streak - a.streak;
    }),
  };
}

module.exports = {
  todayStr,
  addDays,
  calcStreak,
  countMissedDays,
  lastEntryDate,
  sumIncome,
  sumIncomeAllTime,
  summarizeUser,
  summarizeAll,
};
