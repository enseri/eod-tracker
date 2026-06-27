const { getStreakMilestone, streakEmoji } = require('./streak-milestones');

function formatReportDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtPairLine(kind, name, count, target) {
  const label = kind === 'action' ? 'Action' : 'KPI';
  let line = `• **${label}:** ${name || '—'}`;
  if (target != null && target !== '') {
    const done = Number(count) >= Number(target);
    line += ` — ${count} / ${target}${done ? ' completed' : ''}`;
  } else if (count != null && count !== '') {
    line += ` — ${count}`;
  }
  return line;
}

function fmtIncomeLine(stream) {
  const name = stream.name || 'Sales and income';
  const sales = stream.sales != null ? stream.sales : 0;
  const income = Number(stream.income || 0);
  const money = income ? `$${income.toLocaleString('en-US')}` : '$0';
  return `• ${name}: ${sales} sales, ${money}`;
}

function truncateReflection(text, max = 280) {
  const t = String(text || '').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

/**
 * Compact markdown EOD post for Whop accountability chat.
 */
function formatEodChannelMessage({ entry, date, username, streak, isPro }) {
  const e = entry || {};
  const handle = username ? `@${String(username).replace(/^@/, '')}` : '@member';
  const lines = [`**EOD Report — ${handle} — ${formatReportDate(date)}**`, ''];

  (e.pairs || []).forEach((p) => {
    lines.push(fmtPairLine('action', p.action, p.actionCount, p.actionTarget));
    lines.push(fmtPairLine('kpi', p.kpi, p.kpiCount, p.kpiTarget));
  });

  const showReflection = !(e.publish && e.hideEod);
  const showIncome = isPro && !(e.publish && e.hideIncome);

  if (showReflection && (e.reflection || '').trim()) {
    lines.push('', '**Reflection**', truncateReflection(e.reflection));
  } else if (e.publish && e.hideEod) {
    lines.push('', '_Reflection hidden_');
  }

  const streams = e.incomeStreams || [];
  if (showIncome && streams.length) {
    lines.push('', '**Income**');
    streams.forEach((st) => lines.push(fmtIncomeLine(st)));
  } else if (e.publish && e.hideIncome && streams.length) {
    lines.push('', '_Income hidden_');
  }

  const n = Number(streak) || 0;
  const emoji = streakEmoji(n);
  lines.push('', `**Current streak:** ${n} ${emoji}`);

  const milestone = getStreakMilestone(n);
  if (milestone) {
    lines.push(`${milestone.emoji} **${milestone.message}**`);
  }

  return lines.join('\n').trim();
}

module.exports = {
  formatEodChannelMessage,
  formatReportDate,
};
