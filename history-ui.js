/** Shared collapsed history card previews (member + admin). */
(function (global) {
  var DECK_PEEK = 64;
  var DECK_COLLAPSED = 70;
  var DECK_PAGE_SIZE = 35;
  var DECK_PAGE_STEP = 30;

  function escH(s) {
    var d = document.createElement('div');
    d.textContent = String(s || '');
    return d.innerHTML;
  }

  function barPct(val, target) {
    var v = Number(val) || 0;
    if (target == null || target <= 0) return v > 0 ? 100 : 0;
    return Math.min(100, Math.round((v / target) * 100));
  }

  function fmtMoney(n) {
    return '$' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function maxPairCount(entries) {
    var max = 1;
    Object.keys(entries || {}).forEach(function (ds) {
      var n = (entries[ds].pairs || []).length;
      if (n > max) max = n;
    });
    return max;
  }

  function streamNamesFromEntries(entries) {
    var names = [];
    Object.keys(entries || {}).forEach(function (ds) {
      (entries[ds].incomeStreams || []).forEach(function (st, i) {
        var n = (st.name || 'Stream ' + (i + 1)).trim();
        if (names.indexOf(n) === -1) names.push(n);
      });
    });
    return names.length ? names : ['Sales and income'];
  }

  function resolveStreamIncome(entry, streamIndex, entriesMap, streamNames) {
    if (!entry) return 0;
    var names = streamNames || streamNamesFromEntries(entriesMap || {});
    var pick = names[streamIndex] != null ? names[streamIndex] : names[0];
    if (!pick) return 0;
    var streams = entry.incomeStreams || [];
    for (var i = 0; i < streams.length; i++) {
      var n = (streams[i].name || 'Stream ' + (i + 1)).trim();
      if (n === pick) return Number(streams[i].income || 0);
    }
    return streams[streamIndex] ? Number(streams[streamIndex].income || 0) : 0;
  }

  function deckControlsHtml(idPrefix, entries, isPro) {
    var maxPairs = maxPairCount(entries);
    var pairOpts = '';
    for (var i = 0; i < maxPairs; i++) {
      pairOpts += '<option value="' + i + '">Pair ' + (i + 1) + '</option>';
    }
    var streams = streamNamesFromEntries(entries);
    var streamOpts = streams
      .map(function (n, i) {
        return '<option value="' + i + '">' + escH(n) + '</option>';
      })
      .join('');
    var incomeCtrl = isPro
      ? '<label class="history-ctrl">Income stream <select id="' +
        idPrefix +
        '-income-stream">' +
        streamOpts +
        '</select></label>'
      : '';
    return (
      '<div class="history-deck-controls">' +
      '<label class="history-ctrl">KPI / action pair <select id="' +
      idPrefix +
      '-kpi-pair">' +
      pairOpts +
      '</select></label>' +
      incomeCtrl +
      '</div>'
    );
  }

  function fmtDateShort(ds) {
    if (!ds) return '';
    var p = String(ds).split('-');
    if (p.length !== 3) return ds;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[Number(p[1]) - 1] + ' ' + Number(p[2]);
  }

  function fmtCount(count, target) {
    if (target != null) return count + ' / ' + target;
    return String(count);
  }

  function collapsedPreview(entry, pairIndex, streamIndex, isPro, dateLabel, entriesMap, streamNames) {
    if (!entry) return '';
    var pairs = entry.pairs || [];
    var pair = pairs[pairIndex] || pairs[0];
    if (!pair) return '';

    var names = streamNames || streamNamesFromEntries(entriesMap || {});
    var kCount = pair.kpiCount != null ? pair.kpiCount : 0;
    var kTarget = pair.kpiTarget;
    var aCount = pair.actionCount != null ? pair.actionCount : 0;
    var aTarget = pair.actionTarget;

    var kTip = (pair.kpi || 'KPI') + ': ' + (kTarget != null ? kCount + '/' + kTarget : kCount);
    var aTip = (pair.action || 'Action') + ': ' + (aTarget != null ? aCount + '/' + aTarget : aCount);

    var kDisp = fmtCount(kCount, kTarget);
    var aDisp = fmtCount(aCount, aTarget);

    var incomeHtml = '';
    if (isPro) {
      var streamIncome = resolveStreamIncome(entry, streamIndex, entriesMap, names);
      var streamName = names[streamIndex] || names[0] || 'Income';
      incomeHtml =
        '<span class="history-preview-income" title="' +
        escH(streamName) +
        '">' +
        fmtMoney(streamIncome) +
        '</span>';
    }

    var dateHtml = '<span class="history-preview-date">' + escH(dateLabel || '') + '</span>';

    return (
      '<div class="history-day-preview">' +
      '<div class="history-preview-bars" title="' +
      escH(kTip + ' · ' + aTip) +
      '">' +
      '<div class="history-bar-col history-bar-col--kpi">' +
      '<div class="history-bar-track"><div class="history-bar-fill history-bar-fill--kpi" style="width:' +
      barPct(kCount, kTarget) +
      '%"></div></div>' +
      '<span class="history-bar-val">' +
      escH(kDisp) +
      '</span></div>' +
      '<div class="history-bar-col history-bar-col--action">' +
      '<div class="history-bar-track"><div class="history-bar-fill history-bar-fill--action" style="width:' +
      barPct(aCount, aTarget) +
      '%"></div></div>' +
      '<span class="history-bar-val">' +
      escH(aDisp) +
      '</span></div>' +
      '</div>' +
      '<div class="history-preview-footer">' +
      dateHtml +
      incomeHtml +
      '</div>' +
      '</div>'
    );
  }

  function bindDeckControls(root, idPrefix, onChange) {
    var pairSel = root.querySelector('#' + idPrefix + '-kpi-pair');
    var streamSel = root.querySelector('#' + idPrefix + '-income-stream');
    function fire() {
      if (onChange) onChange();
    }
    if (pairSel) pairSel.onchange = fire;
    if (streamSel) streamSel.onchange = fire;
  }

  function getControlIndices(root, idPrefix) {
    var pairSel = root.querySelector('#' + idPrefix + '-kpi-pair');
    var streamSel = root.querySelector('#' + idPrefix + '-income-stream');
    return {
      pairIndex: pairSel ? Number(pairSel.value) || 0 : 0,
      streamIndex: streamSel ? Number(streamSel.value) || 0 : 0,
    };
  }

  function refreshPreviews(root, entriesByDate, isPro, idPrefix) {
    var idx = getControlIndices(root, idPrefix);
    var streamNames = streamNamesFromEntries(entriesByDate);
    root.querySelectorAll('.history-day[data-date]').forEach(function (card) {
      var ds = card.getAttribute('data-date');
      var entry = entriesByDate[ds];
      var slot = card.querySelector('.history-preview-slot');
      if (slot && entry) {
        var dateLabel = card.getAttribute('data-date-fmt') || fmtDateShort(ds);
        slot.innerHTML = collapsedPreview(
          entry,
          idx.pairIndex,
          idx.streamIndex,
          isPro,
          dateLabel,
          entriesByDate,
          streamNames,
        );
      }
    });
  }

  function setDeckHeight(deck) {
    if (!deck) return;
    deck.style.setProperty('--deck-peek', DECK_PEEK + 'px');
    deck.style.setProperty('--deck-collapsed-h', DECK_COLLAPSED + 'px');
    deck.style.minHeight = '';
  }

  function bindDeckEvents(deck, handlers) {
    if (!deck || deck._historyDeckBound) return;
    deck._historyDeckBound = true;
    deck.addEventListener('click', function (e) {
      if (e.target.closest('select')) return;
      var reflBtn = e.target.closest('.history-reflection-btn');
      if (reflBtn) {
        e.stopPropagation();
        if (handlers && handlers.onReflection) handlers.onReflection(reflBtn);
        return;
      }
      var delBtn = e.target.closest('.history-day-delete-btn');
      if (delBtn) {
        e.stopPropagation();
        if (handlers && handlers.onDelete) handlers.onDelete(delBtn);
        return;
      }
      var card = e.target.closest('.history-day');
      if (!card || !deck.contains(card)) return;
      if (handlers && handlers.onToggle) handlers.onToggle(card, deck);
    });
  }

  function resetDeckBindings(deck) {
    if (deck) deck._historyDeckBound = false;
  }

  function loadMoreHtml(hiddenCount, step) {
    if (!hiddenCount || hiddenCount <= 0) return '';
    var n = step || DECK_PAGE_STEP;
    return (
      '<button type="button" class="history-load-more" data-add="' +
      n +
      '">Load ' +
      Math.min(n, hiddenCount) +
      ' older day' +
      (Math.min(n, hiddenCount) === 1 ? '' : 's') +
      ' (' +
      hiddenCount +
      ' hidden)</button>'
    );
  }

  global.HistoryUI = {
    DECK_PAGE_SIZE: DECK_PAGE_SIZE,
    DECK_PAGE_STEP: DECK_PAGE_STEP,
    deckControlsHtml: deckControlsHtml,
    collapsedPreview: collapsedPreview,
    bindDeckControls: bindDeckControls,
    refreshPreviews: refreshPreviews,
    setDeckHeight: setDeckHeight,
    bindDeckEvents: bindDeckEvents,
    resetDeckBindings: resetDeckBindings,
    loadMoreHtml: loadMoreHtml,
    getControlIndices: getControlIndices,
    streamNamesFromEntries: streamNamesFromEntries,
    resolveStreamIncome: resolveStreamIncome,
  };
})(typeof window !== 'undefined' ? window : global);
