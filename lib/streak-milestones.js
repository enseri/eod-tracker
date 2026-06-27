/** EOD submission streak milestones — shared server + browser. */
const STREAK_MILESTONES = [
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

function getStreakMilestone(streak) {
  const n = Number(streak) || 0;
  return STREAK_MILESTONES.find((m) => m.days === n) || null;
}

function getNextStreakMilestone(streak) {
  const n = Number(streak) || 0;
  return STREAK_MILESTONES.find((m) => m.days > n) || null;
}

function streakEmoji(streak) {
  const hit = getStreakMilestone(streak);
  if (hit) return hit.emoji;
  const n = Number(streak) || 0;
  if (n >= 100) return '💯';
  if (n >= 30) return '🔥';
  if (n >= 7) return '⚡';
  if (n >= 3) return '🌱';
  return '✨';
}

module.exports = {
  STREAK_MILESTONES,
  getStreakMilestone,
  getNextStreakMilestone,
  streakEmoji,
};
