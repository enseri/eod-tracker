const PRO_FEATURES = {
  multiPairs: true,
  incomeStreams: true,
  savedOptions: true,
};

const BASIC_LIMITS = {
  maxPairs: 1,
  maxIncomeStreams: 0,
};

function isProTier(tier) {
  return tier === 'pro';
}

function clampSettingsForTier(settings, tier) {
  const s = { ...(settings || {}) };
  if (!isProTier(tier)) {
    s.pairCount = 1;
    s.incomeStreams = [];
  } else {
    s.pairCount = Math.min(3, Math.max(1, s.pairCount || 1));
    s.incomeStreams = Array.isArray(s.incomeStreams) ? s.incomeStreams.slice(0, 3) : [];
  }
  return s;
}

function stripEntryForTier(entry, tier) {
  if (!entry) return entry;
  const e = { ...entry };
  if (!isProTier(tier)) {
    e.incomeStreams = [];
    if (Array.isArray(e.pairs)) e.pairs = e.pairs.slice(0, 1);
  }
  return e;
}

module.exports = { PRO_FEATURES, BASIC_LIMITS, isProTier, clampSettingsForTier, stripEntryForTier };
