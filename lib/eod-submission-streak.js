const { addDays, todayStr, calcStreakFromDates } = require('./central-time');

function calcSubmissionStreak(entries, asOfDate) {
  const map = entries || {};
  const set = new Set(
    Object.keys(map).filter((d) => {
      const e = map[d];
      return e && (e.submittedAt || (Array.isArray(e.pairs) && e.pairs.length));
    }),
  );
  if (!set.size) return 0;
  return calcStreakFromDates(set, asOfDate || todayStr());
}

module.exports = {
  calcSubmissionStreak,
  addDays,
  todayStr,
};
