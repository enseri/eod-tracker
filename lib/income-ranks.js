/**
 * Income ranks + milestone broadcasts (shared server + browser).
 *
 * Two ladders sit on top of member income:
 *   - Monthly RANK tiers (colored name + tag). A member "qualifies" for a tier
 *     by reaching its month-to-date (MTD) threshold. The rank is only *earned*
 *     (sticky tag) after hitting the tier in 2 consecutive calendar months.
 *     Earned rank never downgrades — it holds at the highest tier ever earned.
 *   - Milestone BROADCASTS: finer money thresholds that trigger a chat post the
 *     first time each is crossed. Total (all-time) milestones are opt-in per
 *     member; monthly milestones are always tracked (member can't hide them).
 *
 * IMPORTANT: crossing any of these only becomes official (rank granted, tag
 * shown, message broadcast) once an admin ticks "Income verified" — see
 * lib/income-verify.js for the gate. This module is pure computation.
 *
 * All calendar months use US Central Time (dates are already CT 'YYYY-MM-DD').
 */

// Monthly rank tiers — threshold is MTD income for the month. Order = ascending.
const MONTHLY_RANKS = [
  { key: 'starter', label: 'Starter', threshold: 1000, color: '#5ad1b4', emoji: '🌱' },
  { key: 'closer', label: 'Closer', threshold: 5000, color: '#4ea1ff', emoji: '🤝' },
  { key: 'earner', label: 'Earner', threshold: 10000, color: '#7c5cff', emoji: '💵' },
  { key: 'heavyweight', label: 'Heavyweight', threshold: 25000, color: '#b06bff', emoji: '🥊' },
  { key: 'rainmaker', label: 'Rainmaker', threshold: 50000, color: '#f5c842', emoji: '🌧️' },
  { key: 'mogul', label: 'Mogul', threshold: 100000, color: '#ff9f43', emoji: '🏦' },
  { key: 'titan', label: 'Titan', threshold: 250000, color: '#ff6b5b', emoji: '🗿' },
  { key: 'magnate', label: 'Magnate', threshold: 1000000, color: '#ff4d8d', emoji: '👑' },
  { key: 'empire', label: 'Empire', threshold: 5000000, color: '#d6b4ff', emoji: '🏛️' },
];

// Always-tracked monthly (MTD) broadcast milestones — $100/mo → $5M/mo.
const MONTHLY_MILESTONES = [
  100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000,
  250000, 500000, 1000000, 2500000, 5000000,
];

// Opt-in all-time cumulative broadcast milestones — $1K → $100M.
const TOTAL_MILESTONES = [
  1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000,
  2500000, 5000000, 10000000, 25000000, 50000000, 100000000,
];

function rankIndex(key) {
  if (!key) return -1;
  return MONTHLY_RANKS.findIndex((r) => r.key === key);
}

function rankMeta(key) {
  return MONTHLY_RANKS.find((r) => r.key === key) || null;
}

/** Higher of two rank keys (null-safe). */
function higherRank(a, b) {
  return rankIndex(a) >= rankIndex(b) ? a : b;
}

function shortMoney(n) {
  const v = Number(n || 0);
  const fmt = (x) => {
    const s = x.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (v >= 1000000) return `$${fmt(v / 1000000)}M`;
  if (v >= 1000) return `$${fmt(v / 1000)}K`;
  return `$${v.toLocaleString('en-US')}`;
}

function fullMoney(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Short "$10K/mo"-style tag for a rank tier. */
function rankTag(key) {
  const meta = rankMeta(key);
  return meta ? `${shortMoney(meta.threshold)}/mo` : null;
}

function monthOf(dateStr) {
  return String(dateStr || '').slice(0, 7);
}

function prevMonth(month) {
  const [y, m] = String(month || '').split('-').map(Number);
  if (!y || !m) return null;
  const d = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${d.y}-${String(d.m).padStart(2, '0')}`;
}

/** Sum income for a single calendar month (YYYY-MM). MTD when it's the current month. */
function sumMonthlyIncome(entries, month) {
  let total = 0;
  Object.keys(entries || {}).forEach((ds) => {
    if (monthOf(ds) !== month) return;
    (entries[ds]?.incomeStreams || []).forEach((s) => {
      total += Number(s.income || 0);
    });
  });
  return total;
}

/** Map of month → total income across all entries. */
function monthlyIncomeTotals(entries) {
  const totals = {};
  Object.keys(entries || {}).forEach((ds) => {
    const month = monthOf(ds);
    if (!month) return;
    (entries[ds]?.incomeStreams || []).forEach((s) => {
      totals[month] = (totals[month] || 0) + Number(s.income || 0);
    });
  });
  return totals;
}

/**
 * Highest rank the member has EARNED: the top tier they hit in two consecutive
 * calendar months (as of `asOfMonth`, inclusive — the current month counts once
 * its MTD reaches the threshold).
 */
function qualifiedRank(entries, asOfMonth) {
  const totals = monthlyIncomeTotals(entries);
  const cap = asOfMonth || null;
  let earned = null;

  for (const tier of MONTHLY_RANKS) {
    const months = Object.keys(totals)
      .filter((m) => (!cap || m <= cap) && totals[m] >= tier.threshold);
    const monthSet = new Set(months);
    const twoInARow = months.some((m) => monthSet.has(prevMonth(m)));
    if (twoInARow) earned = higherRank(earned, tier.key);
  }
  return earned;
}

/** This month's tier by MTD (informational, not sticky). */
function currentMonthRank(entries, month) {
  const total = sumMonthlyIncome(entries, month);
  let key = null;
  for (const tier of MONTHLY_RANKS) {
    if (total >= tier.threshold) key = tier.key;
  }
  return key;
}

/** Largest ladder value at or below `value`, or null. */
function highestMilestone(value, ladder) {
  const v = Number(value || 0);
  let hit = null;
  for (const m of ladder) {
    if (v >= m) hit = m;
  }
  return hit;
}

function sumIncomeAllTime(entries) {
  let total = 0;
  Object.keys(entries || {}).forEach((ds) => {
    (entries[ds]?.incomeStreams || []).forEach((s) => {
      total += Number(s.income || 0);
    });
  });
  return total;
}

/**
 * Compare post-submit income against what the member has already been granted
 * (record.income.*). Returns the pending records that a submit unlocked. Nothing
 * here is "official" until an admin verifies (see lib/income-verify.js).
 *
 * granted = {
 *   totalMilestone: number|null,   // highest total milestone already broadcast
 *   monthlyMilestone: number|null, // highest monthly milestone already broadcast
 *   rank: string|null,             // rank key already granted
 * }
 */
function detectIncomeRecords({ entries, date, granted, broadcastTotalMilestones }) {
  const month = monthOf(date);
  const allTimeTotal = sumIncomeAllTime(entries);
  const monthTotal = sumMonthlyIncome(entries, month);

  const newTotalMs = highestMilestone(allTimeTotal, TOTAL_MILESTONES);
  const newMonthlyMs = highestMilestone(monthTotal, MONTHLY_MILESTONES);
  const newRank = qualifiedRank(entries, month);

  const g = granted || {};
  const records = {
    month,
    allTimeTotal,
    monthTotal,
    totalMilestone: null,
    monthlyMilestone: null,
    rank: null,
  };

  // Total milestone broadcast is opt-in per member.
  if (broadcastTotalMilestones && newTotalMs && newTotalMs > (g.totalMilestone || 0)) {
    records.totalMilestone = newTotalMs;
  }
  if (newMonthlyMs && newMonthlyMs > (g.monthlyMilestone || 0)) {
    records.monthlyMilestone = newMonthlyMs;
  }
  if (newRank && rankIndex(newRank) > rankIndex(g.rank || null)) {
    records.rank = newRank;
  }

  records.hasRecord = !!(records.totalMilestone || records.monthlyMilestone || records.rank);
  return records;
}

function formatTotalIncomeMilestoneMessage({ username, milestone }) {
  const handle = username ? `@${String(username).replace(/^@/, '')}` : '@member';
  return `${handle} just crossed ${shortMoney(milestone)} in total income! 🚀 Every rep added up.`;
}

function formatMonthlyIncomeMessage({ username, milestone }) {
  const handle = username ? `@${String(username).replace(/^@/, '')}` : '@member';
  return `${handle} pulled in ${shortMoney(milestone)} this month! 💰 Monthly record set.`;
}

function formatRankMessage({ username, rank }) {
  const meta = rankMeta(rank);
  if (!meta) return '';
  const handle = username ? `@${String(username).replace(/^@/, '')}` : '@member';
  return `${handle} earned the ${meta.label} rank ${meta.emoji} (${rankTag(rank)}) — two months strong.`;
}

module.exports = {
  MONTHLY_RANKS,
  MONTHLY_MILESTONES,
  TOTAL_MILESTONES,
  rankIndex,
  rankMeta,
  rankTag,
  higherRank,
  shortMoney,
  fullMoney,
  monthOf,
  prevMonth,
  sumMonthlyIncome,
  monthlyIncomeTotals,
  qualifiedRank,
  currentMonthRank,
  highestMilestone,
  sumIncomeAllTime,
  detectIncomeRecords,
  formatTotalIncomeMilestoneMessage,
  formatMonthlyIncomeMessage,
  formatRankMessage,
};
