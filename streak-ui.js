/** Client-side submission streak + milestones (mirrors lib/streak-milestones.js). */
(function (global) {
  var STREAK_MILESTONES = [
    { days: 1, emoji: '✨', message: 'Day one — you showed up. That\'s the whole game.' },
    { days: 3, emoji: '🌱', message: 'Three deep. The habit is rooting.' },
    { days: 5, emoji: '🎵', message: 'Five in a row — you\'re finding your groove.' },
    { days: 7, emoji: '🔁', message: 'Full week locked. Rhythm unlocked.' },
    { days: 10, emoji: '🔥', message: 'Ten days straight. The standard is set.' },
    { days: 14, emoji: '⚡', message: 'Two weeks deep. Different energy.' },
    { days: 21, emoji: '🧠', message: '21 days — reps becoming identity.' },
    { days: 30, emoji: '🏔️', message: 'A full month. Rare air.' },
    { days: 45, emoji: '🛹', message: '45 days — smooth, consistent, cold.' },
    { days: 60, emoji: '💪', message: 'Sixty deep. Discipline looks good on you.' },
    { days: 75, emoji: '🚀', message: '75 days — momentum is a lifestyle now.' },
    { days: 90, emoji: '🌊', message: '90-day wave. You\'re surfing it.' },
    { days: 100, emoji: '💯', message: 'Triple digits. Legend behavior.' },
    { days: 150, emoji: '🔥', message: '150-day heater. Consistency you can\'t fake.' },
    { days: 200, emoji: '👑', message: '200 days. Crown-worthy discipline.' },
    { days: 250, emoji: '💎', message: '250 — pressure made you a diamond.' },
    { days: 300, emoji: '🎯', message: '300 days. Surgical consistency.' },
    { days: 365, emoji: '🌍', message: 'One full year. A different life in 365 EODs.' },
    { days: 500, emoji: '🛸', message: '500 days. Another orbit entirely.' },
    { days: 750, emoji: '🏆', message: '750 — hall-of-fame accountability.' },
    { days: 1000, emoji: '🌌', message: '1K streak. Universe-level commitment.' },
  ];

  function todayStr() {
    var d = new Date();
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function calcVisitStreak(visits, asOfDate) {
    var set = {};
    (visits || []).forEach(function (d) {
      if (d) set[d] = true;
    });
    if (!Object.keys(set).length) return 0;
    var streak = 0;
    var cur = new Date((asOfDate || todayStr()) + 'T00:00:00');
    while (true) {
      var ds = cur.toISOString().slice(0, 10);
      if (set[ds]) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function calcSubmissionStreak(entries, asOfDate) {
    var map = entries || {};
    var set = {};
    Object.keys(map).forEach(function (d) {
      var e = map[d];
      if (e && (e.submittedAt || (e.pairs && e.pairs.length))) set[d] = true;
    });
    if (!Object.keys(set).length) return 0;
    var streak = 0;
    var cur = new Date((asOfDate || todayStr()) + 'T00:00:00');
    while (true) {
      var ds = cur.toISOString().slice(0, 10);
      if (set[ds]) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else break;
    }
    return streak;
  }

  function getStreakMilestone(streak) {
    var n = Number(streak) || 0;
    for (var i = 0; i < STREAK_MILESTONES.length; i++) {
      if (STREAK_MILESTONES[i].days === n) return STREAK_MILESTONES[i];
    }
    return null;
  }

  function getNextStreakMilestone(streak) {
    var n = Number(streak) || 0;
    for (var i = 0; i < STREAK_MILESTONES.length; i++) {
      if (STREAK_MILESTONES[i].days > n) return STREAK_MILESTONES[i];
    }
    return null;
  }

  function streakEmoji(streak) {
    var hit = getStreakMilestone(streak);
    if (hit) return hit.emoji;
    var n = Number(streak) || 0;
    if (n >= 100) return '💯';
    if (n >= 30) return '🔥';
    if (n >= 7) return '⚡';
    if (n >= 3) return '🌱';
    return '✨';
  }

  global.EodStreak = {
    STREAK_MILESTONES: STREAK_MILESTONES,
    calcVisitStreak: calcVisitStreak,
    calcSubmissionStreak: calcSubmissionStreak,
    getStreakMilestone: getStreakMilestone,
    getNextStreakMilestone: getNextStreakMilestone,
    streakEmoji: streakEmoji,
    todayStr: todayStr,
  };
})(typeof window !== 'undefined' ? window : global);
