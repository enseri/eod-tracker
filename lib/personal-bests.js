const { formatReportDate } = require('./eod-channel-format');

function normName(s) {
  const t = String(s || '').trim();
  return t || null;
}

function scanPriorBests(entries, isPro) {
  const bests = {
    action: new Map(),
    kpi: new Map(),
    sales: new Map(),
    income: new Map(),
  };

  Object.values(entries || {}).forEach((e) => {
    (e.pairs || []).forEach((p) => {
      const aName = normName(p.action);
      const kName = normName(p.kpi);
      const aCount = Number(p.actionCount) || 0;
      const kCount = Number(p.kpiCount) || 0;
      if (aName) bests.action.set(aName, Math.max(bests.action.get(aName) || 0, aCount));
      if (kName) bests.kpi.set(kName, Math.max(bests.kpi.get(kName) || 0, kCount));
    });

    if (!isPro) return;

    (e.incomeStreams || []).forEach((st) => {
      const sName = normName(st.name) || 'Sales and income';
      const sales = Number(st.sales) || 0;
      const income = Number(st.income) || 0;
      bests.sales.set(sName, Math.max(bests.sales.get(sName) || 0, sales));
      bests.income.set(sName, Math.max(bests.income.get(sName) || 0, income));
    });
  });

  return bests;
}

function foldEntryIntoBests(bests, entry, isPro) {
  if (!entry) return;
  (entry.pairs || []).forEach((p) => {
    const aName = normName(p.action);
    const kName = normName(p.kpi);
    const aCount = Number(p.actionCount) || 0;
    const kCount = Number(p.kpiCount) || 0;
    if (aName) bests.action.set(aName, Math.max(bests.action.get(aName) || 0, aCount));
    if (kName) bests.kpi.set(kName, Math.max(bests.kpi.get(kName) || 0, kCount));
  });

  if (!isPro) return;

  (entry.incomeStreams || []).forEach((st) => {
    const sName = normName(st.name) || 'Sales and income';
    const sales = Number(st.sales) || 0;
    const income = Number(st.income) || 0;
    bests.sales.set(sName, Math.max(bests.sales.get(sName) || 0, sales));
    bests.income.set(sName, Math.max(bests.income.get(sName) || 0, income));
  });
}

/**
 * Compare entry against all-time bests. Excludes `date` from history scan, then
 * folds in `previousEntry` (same-day value before override) so replacing an
 * entry only counts as a PB when the new value beats the old all-time high.
 */
function detectPersonalBests({ entry, entries, date, isPro, previousEntry }) {
  const prior = { ...(entries || {}) };
  if (date) delete prior[date];

  const bests = scanPriorBests(prior, isPro);
  if (previousEntry) foldEntryIntoBests(bests, previousEntry, isPro);
  const records = [];
  const e = entry || {};
  const hideIncome = !!(e.publish && e.hideIncome);

  (e.pairs || []).forEach((p) => {
    const aName = normName(p.action);
    const kName = normName(p.kpi);
    const aCount = Number(p.actionCount) || 0;
    const kCount = Number(p.kpiCount) || 0;

    if (aName && aCount > (bests.action.get(aName) || 0)) {
      records.push({
        type: 'action',
        name: aName,
        value: aCount,
        previous: bests.action.get(aName) || 0,
      });
    }
    if (kName && kCount > (bests.kpi.get(kName) || 0)) {
      records.push({
        type: 'kpi',
        name: kName,
        value: kCount,
        previous: bests.kpi.get(kName) || 0,
      });
    }
  });

  if (isPro && !hideIncome) {
    (e.incomeStreams || []).forEach((st) => {
      const sName = normName(st.name) || 'Sales and income';
      const sales = Number(st.sales) || 0;
      const income = Number(st.income) || 0;

      if (sales > (bests.sales.get(sName) || 0)) {
        records.push({
          type: 'sales',
          name: sName,
          value: sales,
          previous: bests.sales.get(sName) || 0,
        });
      }
      if (income > (bests.income.get(sName) || 0)) {
        records.push({
          type: 'income',
          name: sName,
          value: income,
          previous: bests.income.get(sName) || 0,
        });
      }
    });
  }

  return records;
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatPersonalBestsMessage({ username, records, date }) {
  if (!records?.length) return '';

  const handle = username ? `@${String(username).replace(/^@/, '')}` : '@member';
  const lines = [`New personal bests — ${handle} — ${formatReportDate(date)}`, ''];

  records.forEach((r) => {
    if (r.type === 'action') {
      lines.push(`Action "${r.name}" — new personal best`);
    } else if (r.type === 'kpi') {
      lines.push(`KPI "${r.name}" — new personal best`);
    } else if (r.type === 'sales') {
      lines.push(`Sales "${r.name}" — new personal best`);
    } else if (r.type === 'income') {
      lines.push(`Income "${r.name}" — new personal best`);
    }
  });

  return lines.join('\n').trim();
}

const PB_TYPE_ORDER = { Action: 0, KPI: 1, Sales: 2, Income: 3 };

function buildPersonalBestsRows(entries, isPro) {
  const bests = scanPriorBests(entries, isPro);
  const rows = [];

  bests.action.forEach((val, name) => {
    if (val > 0) rows.push({ type: 'Action', name, best: val, isMoney: false });
  });
  bests.kpi.forEach((val, name) => {
    if (val > 0) rows.push({ type: 'KPI', name, best: val, isMoney: false });
  });
  if (isPro) {
    bests.sales.forEach((val, name) => {
      if (val > 0) rows.push({ type: 'Sales', name, best: val, isMoney: false });
    });
    bests.income.forEach((val, name) => {
      if (val > 0) rows.push({ type: 'Income', name, best: val, isMoney: true });
    });
  }

  rows.sort((a, b) => {
    const ta = PB_TYPE_ORDER[a.type] ?? 9;
    const tb = PB_TYPE_ORDER[b.type] ?? 9;
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

function formatPersonalBestValue(row) {
  if (row.isMoney) return `$${fmtMoney(row.best)}`;
  return String(row.best);
}

module.exports = {
  detectPersonalBests,
  formatPersonalBestsMessage,
  formatPersonalBestValue,
  buildPersonalBestsRows,
  scanPriorBests,
};
