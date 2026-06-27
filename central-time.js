/** Client mirror of lib/central-time.js — US Central (America/Chicago). */
(function (global) {
  var APP_TIMEZONE = 'America/Chicago';

  function todayStr(now) {
    return (now || new Date()).toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
  }

  function parseDateParts(dateStr) {
    var p = String(dateStr || '').split('-').map(Number);
    return { year: p[0], month: p[1], day: p[2] };
  }

  function addOneDay(dateStr, step) {
    var parts = parseDateParts(dateStr);
    var utcNoon = Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0);
    var next = new Date(utcNoon + (step || 1) * 86400000);
    return next.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
  }

  function addDays(dateStr, delta) {
    if (!dateStr || !delta) return dateStr;
    var current = dateStr;
    var step = delta > 0 ? 1 : -1;
    for (var i = 0; i < Math.abs(delta); i++) current = addOneDay(current, step);
    return current;
  }

  function calcStreakFromDates(dates, asOfDate) {
    var set = dates instanceof Set ? dates : new Set(dates || []);
    var streak = 0;
    var cur = asOfDate || todayStr();
    while (set.has(cur)) {
      streak += 1;
      cur = addDays(cur, -1);
    }
    return streak;
  }

  global.CentralTime = {
    APP_TIMEZONE: APP_TIMEZONE,
    todayStr: todayStr,
    addDays: addDays,
    addOneDay: addOneDay,
    calcStreakFromDates: calcStreakFromDates,
  };
})(typeof window !== 'undefined' ? window : global);
