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

function calcStreakFromDates(dates, asOfDate) {
  const set = dates instanceof Set ? dates : new Set(dates || []);
  let streak = 0;
  let cur = asOfDate || todayStr();
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
