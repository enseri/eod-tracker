/**
 * Income verification gate (shared server logic).
 *
 * Flow (per manager spec):
 *   1. A member submit that crosses a new total milestone, monthly milestone, or
 *      rank tier marks the record "pending" and forces incomeVerified = false
 *      ("hold"). Nothing is broadcast and no rank/tag is granted yet.
 *   2. An admin ticks "Income verified". Only then do the pending broadcasts fire
 *      and the granted rank advances (rank tag becomes official). Rank still
 *      requires the 2-consecutive-month rule baked into qualifiedRank().
 *   3. The next new record resets incomeVerified to false again and re-holds.
 *
 * Granted values never regress, so a member is never publicly downgraded.
 *
 * Per-user record fields (flat, merge-friendly with lib/store.js):
 *   incomeVerified                bool
 *   incomeGrantedRank             rank key | null   (sticky, highest granted)
 *   incomeRankOverride            rank key | null   (admin manual override)
 *   incomeGrantedTotalMilestone   number | null
 *   incomeGrantedMonthlyMilestone number | null
 *   incomePending                 { totalMilestone, monthlyMilestone, rank, month, detectedAt } | null
 */
const {
  detectIncomeRecords,
  higherRank,
  rankIndex,
  rankMeta,
  rankTag,
  formatTotalIncomeMilestoneMessage,
  formatMonthlyIncomeMessage,
  formatRankMessage,
} = require('./income-ranks');

function grantedFromRecord(record) {
  return {
    totalMilestone: record?.incomeGrantedTotalMilestone || 0,
    monthlyMilestone: record?.incomeGrantedMonthlyMilestone || 0,
    rank: record?.incomeGrantedRank || null,
  };
}

/** Rank shown on tags = admin override if set, else highest granted. */
function displayRank(record) {
  if (record?.incomeRankOverride) return record.incomeRankOverride;
  return record?.incomeGrantedRank || null;
}

/**
 * Called after a member submit. Returns a patch of income fields to persist
 * (empty when nothing new). A new record forces incomeVerified = false and
 * stores what is awaiting admin approval.
 */
function detectOnSubmit(record, { entries, date, broadcastTotalMilestones }) {
  const records = detectIncomeRecords({
    entries,
    date,
    granted: grantedFromRecord(record),
    broadcastTotalMilestones: !!broadcastTotalMilestones,
  });

  if (!records.hasRecord) return { patch: {}, changed: false, records };

  const pending = {
    totalMilestone: records.totalMilestone || null,
    monthlyMilestone: records.monthlyMilestone || null,
    rank: records.rank || null,
    month: records.month,
    detectedAt: new Date().toISOString(),
  };

  return {
    patch: { incomeVerified: false, incomePending: pending },
    changed: true,
    records,
  };
}

/**
 * Called when an admin ticks "Income verified". Advances granted values, clears
 * pending, and returns the broadcast messages to post. When there is no pending
 * record, it just flips the flag with no broadcasts.
 */
function applyVerification(record, { username }) {
  const pending = record?.incomePending || null;

  if (!pending) {
    return {
      patch: { incomeVerified: true },
      broadcasts: [],
    };
  }

  const patch = { incomeVerified: true, incomePending: null };
  const broadcasts = [];

  if (pending.totalMilestone && pending.totalMilestone > (record.incomeGrantedTotalMilestone || 0)) {
    patch.incomeGrantedTotalMilestone = pending.totalMilestone;
    broadcasts.push({
      type: 'total',
      label: 'Total income record',
      content: formatTotalIncomeMilestoneMessage({ username, milestone: pending.totalMilestone }),
    });
  }

  if (pending.monthlyMilestone && pending.monthlyMilestone > (record.incomeGrantedMonthlyMilestone || 0)) {
    patch.incomeGrantedMonthlyMilestone = pending.monthlyMilestone;
    broadcasts.push({
      type: 'monthly',
      label: 'Monthly income record',
      content: formatMonthlyIncomeMessage({ username, milestone: pending.monthlyMilestone }),
    });
  }

  if (pending.rank && rankIndex(pending.rank) > rankIndex(record.incomeGrantedRank || null)) {
    patch.incomeGrantedRank = higherRank(record.incomeGrantedRank || null, pending.rank);
    broadcasts.push({
      type: 'rank',
      label: 'New rank',
      rank: patch.incomeGrantedRank,
      content: formatRankMessage({ username, rank: patch.incomeGrantedRank }),
    });
  }

  return { patch, broadcasts };
}

/** Admin manually setting/clearing the rank override. */
function applyRankOverride(rankKey) {
  const valid = rankKey && rankMeta(rankKey) ? rankKey : null;
  return { patch: { incomeRankOverride: valid } };
}

/** Compact income summary for the admin panel. */
function incomeSummary(record) {
  const shown = displayRank(record);
  const meta = shown ? rankMeta(shown) : null;
  return {
    incomeVerified: !!record?.incomeVerified,
    incomePending: !!record?.incomePending,
    rank: shown,
    rankLabel: meta ? meta.label : null,
    rankColor: meta ? meta.color : null,
    rankTag: shown ? rankTag(shown) : null,
    rankOverridden: !!record?.incomeRankOverride,
  };
}

module.exports = {
  grantedFromRecord,
  displayRank,
  detectOnSubmit,
  applyVerification,
  applyRankOverride,
  incomeSummary,
};
