const { APP_TIMEZONE } = require('./central-time');
const { rankMeta, rankTag, fullMoney } = require('./income-ranks');
const { streakEmoji } = require('./streak-milestones');

function formatReportDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const DEFAULT_ACTION_VERB = 'were completed';
const DEFAULT_KPI_VERB = 'happened';
// Verbs offered in the option edit modal (client mirrors this list).
const ADLIB_VERBS = ['were completed', 'happened', 'was reached', 'were reached', 'occurred'];

function num(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function pluralizeNoun(name, count, plural) {
  const base = String(name || '').trim() || 'item';
  // Literal "(s)" (manager spec) — unambiguous and avoids bad plurals like
  // "DM sents" or "memberss". Only when enabled and the count isn't exactly 1.
  if (plural && num(count) !== 1) return `${base}(s)`;
  return base;
}

function capitalize(str) {
  const s = String(str || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "5/10 Calls were completed" or "5 Calls were completed" (no target). */
function metricSegment(name, count, target, verb, plural, isBest) {
  const noun = pluralizeNoun(name, count, plural);
  const c = num(count);
  const hasTarget = target != null && target !== '';
  const stem = hasTarget ? `${c}/${num(target)} ${noun}` : `${c} ${noun}`;
  return `${stem} ${verb || DEFAULT_KPI_VERB}${isBest ? ' (new best)' : ''}`;
}

function pairSentence(p, best) {
  const b = best || {};
  const segs = [];
  if ((p.action || '').trim() || p.actionCount != null) {
    const isBest = b.action && b.action.has(String(p.action || '').trim());
    segs.push(
      metricSegment(p.action || 'action', p.actionCount, p.actionTarget, p.actionVerb || DEFAULT_ACTION_VERB, p.actionPlural, isBest),
    );
  }
  if ((p.kpi || '').trim() || p.kpiCount != null) {
    const isBest = b.kpi && b.kpi.has(String(p.kpi || '').trim());
    segs.push(
      metricSegment(p.kpi || 'KPI', p.kpiCount, p.kpiTarget, p.kpiVerb || DEFAULT_KPI_VERB, p.kpiPlural, isBest),
    );
  }
  if (!segs.length) return '';
  return capitalize(segs.join(' and ')) + '.';
}

/** Group personal-best records by type into name sets for inline "(new best)". */
function bestSets(records) {
  const best = { action: new Set(), kpi: new Set(), sales: new Set(), income: new Set() };
  (records || []).forEach((r) => {
    if (best[r.type]) best[r.type].add(String(r.name || '').trim());
  });
  return best;
}

/**
 * Performance tone is based on ACTIONS + KPIs only — never money (manager rule).
 */
function performanceTone(pairs) {
  const list = pairs || [];
  let totalAction = 0;
  let totalKpi = 0;
  let targetTotal = 0;
  let targetMet = 0;

  list.forEach((p) => {
    totalAction += num(p.actionCount);
    totalKpi += num(p.kpiCount);
    if (p.actionTarget != null && p.actionTarget !== '') {
      targetTotal += 1;
      if (num(p.actionCount) >= num(p.actionTarget)) targetMet += 1;
    }
    if (p.kpiTarget != null && p.kpiTarget !== '') {
      targetTotal += 1;
      if (num(p.kpiCount) >= num(p.kpiTarget)) targetMet += 1;
    }
  });

  if (totalAction === 0 && totalKpi === 0) {
    return { opener: 'showed up', emoji: '🙏', praise: 'Showing up is the hard part. Respect. 🙏' };
  }
  if (totalAction === 0) {
    return { opener: 'showed up', emoji: '🙏', praise: 'No actions logged, but the KPIs still moved. Respect. 🙏' };
  }
  if (targetTotal > 0 && targetMet === targetTotal) {
    return { opener: 'is on fire', emoji: '🔥', praise: 'Woah — every target hit. Elite output. 👏' };
  }
  if (targetTotal > 0 && targetMet >= Math.ceil(targetTotal / 2)) {
    return { opener: 'put in work', emoji: '💪', praise: 'Solid, consistent reps today. 👏' };
  }
  return { opener: 'made moves', emoji: '✅', praise: 'Progress logged — keep stacking. 💪' };
}

function truncateReflection(text, max = 280) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

function moneyLine(streams, best) {
  const list = streams || [];
  let sales = 0;
  let income = 0;
  list.forEach((s) => {
    sales += num(s.sales);
    income += num(s.income);
  });
  if (sales === 0 && income === 0) return '';
  const saleWord = sales === 1 ? 'sale' : 'sales';
  const salesBest = best && best.sales && best.sales.size ? ' (new best)' : '';
  const incomeBest = best && best.income && best.income.size ? ' (new best)' : '';
  return `They made ${sales} ${saleWord}${salesBest} today and ${fullMoney(income)}${incomeBest} in income. 💰`;
}

/** Optional "[Earner · $10K/mo]" tag appended to the handle (chat prefix fallback). */
function rankSuffix(rank) {
  const meta = rank ? rankMeta(rank) : null;
  if (!meta) return '';
  return ` [${meta.label} · ${rankTag(rank)}]`;
}

/**
 * Human-readable EOD post for Whop accountability chat.
 * `rank`    (optional) granted rank key — shown inline (webhook can't render a native badge).
 * `streak`  (optional) current streak; rendered with a tiered emoji.
 * `records` (optional) personal-best records → annotated inline as "(new best)"
 *           instead of a separate, clunky message.
 */
function formatEodChannelMessage({ entry, date, username, isPro, rank, streak, records }) {
  const e = entry || {};
  const handle = (username ? `@${String(username).replace(/^@/, '')}` : '@member') + rankSuffix(rank);
  const tone = performanceTone(e.pairs || []);
  const best = bestSets(records);

  const lines = [`${handle} ${tone.opener} today ${tone.emoji}`];

  (e.pairs || []).forEach((p) => {
    const sentence = pairSentence(p, best);
    if (sentence) lines.push(sentence);
  });

  const showIncome = isPro && !(e.publish && e.hideIncome);
  if (showIncome) {
    const ml = moneyLine(e.incomeStreams, best);
    if (ml) lines.push(ml);
  }

  lines.push(tone.praise);

  const n = Number(streak) || 0;
  if (n > 0) {
    lines.push(`${n}-day streak ${streakEmoji(n)}`);
  }

  const showReflection = !(e.publish && e.hideEod);
  if (showReflection && (e.reflection || '').trim()) {
    lines.push(`Reflection: ${truncateReflection(e.reflection)}`);
  }

  return lines.join('\n').trim();
}

module.exports = {
  formatEodChannelMessage,
  formatReportDate,
  ADLIB_VERBS,
  DEFAULT_ACTION_VERB,
  DEFAULT_KPI_VERB,
  performanceTone,
  pairSentence,
};
