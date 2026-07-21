/** App calendar dates use US Central Time (America/Chicago — CST/CDT). */
const APP_TIMEZONE = 'America/Chicago';

function todayStr(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

function parseDateParts(dateStr) {
  const [year, month, day] = String(dateStr || '').split('-').map(Number);
  return { year, month, day };
}

function addOneDay(dateStr, step = 1) {
  const { year, month, day } = parseDateParts(dateStr);
  const utcNoon = Date.UTC(year, month - 1, day, 12, 0, 0);
  const next = new Date(utcNoon + step * 86400000);
  return next.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

function addDays(dateStr, delta) {
  if (!dateStr || !delta) return dateStr;
  let current = dateStr;
  const step = delta > 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(delta); i += 1) {
    current = addOneDay(current, step);
  }
  return current;
}

/**
 * Current streak length as of `asOfDate` (default today, US Central).
 *
 * A streak stays "alive" for the whole current day even before today's entry
 * exists: if today has no date but yesterday does, we count from yesterday.
 * This is what lets the admin overview show a member's real streak all day
 * (and spot who is about to lose one) instead of resetting everyone to 0 at
 * midnight until they submit. The streak only reads 0 once a full day is
 * actually missed (neither today nor yesterday present).
 */
function calcStreakFromDates(dates, asOfDate) {
  const set = dates instanceof Set ? dates : new Set(dates || []);
  const today = asOfDate || todayStr();
  const yesterday = addDays(today, -1);

  let start = null;
  if (set.has(today)) start = today;
  else if (set.has(yesterday)) start = yesterday;
  if (!start) return 0;

  let streak = 0;
  let cur = start;
  while (set.has(cur)) {
    streak += 1;
    cur = addDays(cur, -1);
  }
  return streak;
}

function centralWallClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { hours: get('hour'), minutes: get('minute'), seconds: get('second') };
}

/** Whole hours until the next Central calendar day (ceil). */
function hoursUntilCentralMidnight(now = new Date()) {
  const { hours, minutes, seconds } = centralWallClock(now);
  const elapsed = hours * 3600 + minutes * 60 + seconds;
  const remaining = 86400 - elapsed;
  return Math.max(0, Math.ceil(remaining / 3600));
}

module.exports = {
  APP_TIMEZONE,
  todayStr,
  addDays,
  addOneDay,
  calcStreakFromDates,
  centralWallClock,
  hoursUntilCentralMidnight,
};
