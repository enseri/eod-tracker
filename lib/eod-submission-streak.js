const { addDays, todayStr } = require('./analytics');

function calcSubmissionStreak(entries, asOfDate) {
  const map = entries || {};
  const set = new Set(
    Object.keys(map).filter((d) => {
      const e = map[d];
      return e && (e.submittedAt || (Array.isArray(e.pairs) && e.pairs.length));
    }),
  );
  if (!set.size) return 0;

  let streak = 0;
  const anchor = asOfDate || todayStr();
  const cur = new Date(anchor + 'T00:00:00');
  while (true) {
    const ds = cur.toISOString().slice(0, 10);
    if (set.has(ds)) {
      streak += 1;
      cur.setDate(cur.getDate() - 1);
    } else break;
  }
  return streak;
}

module.exports = {
  calcSubmissionStreak,
  addDays,
  todayStr,
};
