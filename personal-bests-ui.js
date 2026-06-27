/** Client-side personal bests table (mirrors lib/personal-bests.js). */
(function (global) {
  var TYPE_ORDER = { Action: 0, KPI: 1, Sales: 2, Income: 3 };

  function normName(s) {
    var t = String(s || '').trim();
    return t || null;
  }

  function scanAllBests(entries, isPro) {
    var bests = {
      action: {},
      kpi: {},
      sales: {},
      income: {},
    };

    function setMax(map, key, val) {
      if (!key) return;
      map[key] = Math.max(map[key] || 0, val);
    }

    Object.keys(entries || {}).forEach(function (ds) {
      var e = entries[ds];
      (e.pairs || []).forEach(function (p) {
        setMax(bests.action, normName(p.action), Number(p.actionCount) || 0);
        setMax(bests.kpi, normName(p.kpi), Number(p.kpiCount) || 0);
      });
      if (!isPro) return;
      (e.incomeStreams || []).forEach(function (st) {
        var sName = normName(st.name) || 'Sales and income';
        setMax(bests.sales, sName, Number(st.sales) || 0);
        setMax(bests.income, sName, Number(st.income) || 0);
      });
    });

    return bests;
  }

  function buildRows(entries, isPro) {
    var bests = scanAllBests(entries, isPro);
    var rows = [];

    Object.keys(bests.action).forEach(function (name) {
      var val = bests.action[name];
      if (val > 0) rows.push({ type: 'Action', name: name, best: val, isMoney: false });
    });
    Object.keys(bests.kpi).forEach(function (name) {
      var val = bests.kpi[name];
      if (val > 0) rows.push({ type: 'KPI', name: name, best: val, isMoney: false });
    });
    if (isPro) {
      Object.keys(bests.sales).forEach(function (name) {
        var val = bests.sales[name];
        if (val > 0) rows.push({ type: 'Sales', name: name, best: val, isMoney: false });
      });
      Object.keys(bests.income).forEach(function (name) {
        var val = bests.income[name];
        if (val > 0) rows.push({ type: 'Income', name: name, best: val, isMoney: true });
      });
    }

    rows.sort(function (a, b) {
      var ta = TYPE_ORDER[a.type] != null ? TYPE_ORDER[a.type] : 9;
      var tb = TYPE_ORDER[b.type] != null ? TYPE_ORDER[b.type] : 9;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }

  function formatBest(row) {
    if (row.isMoney) {
      return '$' + Number(row.best || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
    }
    return String(row.best);
  }

  function foldEntryIntoBests(bests, entry, isPro) {
    if (!entry) return;
    (entry.pairs || []).forEach(function (p) {
      setMax(bests.action, normName(p.action), Number(p.actionCount) || 0);
      setMax(bests.kpi, normName(p.kpi), Number(p.kpiCount) || 0);
    });
    if (!isPro) return;
    (entry.incomeStreams || []).forEach(function (st) {
      var sName = normName(st.name) || 'Sales and income';
      setMax(bests.sales, sName, Number(st.sales) || 0);
      setMax(bests.income, sName, Number(st.income) || 0);
    });
  }

  function detectNewRecords(entry, entries, date, isPro, previousEntry) {
    var prior = {};
    Object.keys(entries || {}).forEach(function (ds) {
      if (ds !== date) prior[ds] = entries[ds];
    });
    var bests = scanAllBests(prior, isPro);
    if (previousEntry) foldEntryIntoBests(bests, previousEntry, isPro);
    var records = [];
    var e = entry || {};

    (e.pairs || []).forEach(function (p) {
      var aName = normName(p.action);
      var kName = normName(p.kpi);
      var aCount = Number(p.actionCount) || 0;
      var kCount = Number(p.kpiCount) || 0;
      if (aName && aCount > (bests.action[aName] || 0)) {
        records.push({ type: 'action', name: aName });
      }
      if (kName && kCount > (bests.kpi[kName] || 0)) {
        records.push({ type: 'kpi', name: kName });
      }
    });

    if (isPro) {
      (e.incomeStreams || []).forEach(function (st) {
        var sName = normName(st.name) || 'Sales and income';
        var sales = Number(st.sales) || 0;
        var income = Number(st.income) || 0;
        if (sales > (bests.sales[sName] || 0)) {
          records.push({ type: 'sales', name: sName });
        }
        if (income > (bests.income[sName] || 0)) {
          records.push({ type: 'income', name: sName });
        }
      });
    }

    return records;
  }

  global.PersonalBests = {
    buildRows: buildRows,
    formatBest: formatBest,
    detectNewRecords: detectNewRecords,
  };
})(typeof window !== 'undefined' ? window : global);
