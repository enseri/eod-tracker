const { formatEodChannelMessage } = require('./eod-channel-format');
const { calcStreak } = require('./analytics');
const { getStreakMilestone } = require('./streak-milestones');
const { detectPersonalBests, formatPersonalBestsMessage } = require('./personal-bests');

function getAccountabilityWebhookUrl() {
  const url =
    (process.env.WHOP_ACCOUNTABILITY_WEBHOOK_URL || '').trim() ||
    (process.env.WHOP_CHAT_WEBHOOK_URL || '').trim() ||
    '';
  return url.startsWith('http') ? url : null;
}

async function postToAccountabilityWebhook(webhookUrl, username, content) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, content }),
  });

  if (!res.ok) {
    const snippet = (await res.text().catch(() => '')).slice(0, 160);
    throw new Error(`Webhook ${res.status}${snippet ? `: ${snippet}` : ''}`);
  }

  return { ok: true };
}

async function publishEodToChannel({
  entry,
  date,
  username,
  entries,
  isPro,
  previousEntry,
  visits,
  streakNotifications = true,
}) {
  if (!entry?.publish) {
    return { skipped: true, reason: 'not_published' };
  }

  const webhookUrl = getAccountabilityWebhookUrl();
  if (!webhookUrl) {
    return {
      skipped: true,
      reason: 'no_webhook',
      hint:
        'Set WHOP_ACCOUNTABILITY_WEBHOOK_URL in Vercel — create the webhook in your Whop Chat app settings and paste the URL here.',
    };
  }

  const streak = calcStreak(visits || []);
  const content = formatEodChannelMessage({
    entry,
    date,
    username,
    streak,
    isPro,
  });
  const milestone = streakNotifications ? getStreakMilestone(streak) : null;
  const handle = username ? String(username).replace(/^@/, '') : 'Member';

  try {
    await postToAccountabilityWebhook(webhookUrl, `${handle} — EOD`, content);

    const records = detectPersonalBests({ entry, entries, date, isPro, previousEntry });
    let personalBests = { skipped: true, records: [] };

    if (records.length) {
      const recordContent = formatPersonalBestsMessage({ username, records, date });
      try {
        await postToAccountabilityWebhook(webhookUrl, `${handle} — Record`, recordContent);
        personalBests = { ok: true, records };
      } catch (err) {
        console.error('personal bests webhook failed:', err.message);
        personalBests = { ok: false, records, error: err.message || 'Failed to post record message' };
      }
    }

    return {
      ok: true,
      webhook: true,
      streak,
      milestone,
      personalBests,
    };
  } catch (err) {
    console.error('publishEodToChannel webhook failed:', err.message);
    return {
      ok: false,
      error: err.message || 'Failed to post to accountability chat webhook',
      streak,
      milestone,
    };
  }
}

function formatVisitStreakMilestoneMessage({ username, milestone, streak }) {
  if (!milestone) return '';
  const handle = username ? `@${String(username).replace(/^@/, '')}` : '@member';
  return `${milestone.emoji} Streak milestone — ${handle}\n\n${milestone.message}\n\n${streak}-day app streak`;
}

async function publishVisitStreakMilestone({ username, visits, streakNotifications = true }) {
  if (streakNotifications === false) {
    return { skipped: true, reason: 'streak_notifications_off' };
  }

  const webhookUrl = getAccountabilityWebhookUrl();
  if (!webhookUrl) {
    return { skipped: true, reason: 'no_webhook' };
  }

  const streak = calcStreak(visits || []);
  const milestone = getStreakMilestone(streak);
  if (!milestone) {
    return { skipped: true, reason: 'no_milestone', streak };
  }

  const handle = username ? String(username).replace(/^@/, '') : 'Member';
  const content = formatVisitStreakMilestoneMessage({ username, milestone, streak });

  try {
    await postToAccountabilityWebhook(webhookUrl, `${handle} — Streak`, content);
    return { ok: true, streak, milestone };
  } catch (err) {
    console.error('publishVisitStreakMilestone failed:', err.message);
    return { ok: false, error: err.message || 'Failed to post streak milestone', streak, milestone };
  }
}

module.exports = {
  getAccountabilityWebhookUrl,
  publishEodToChannel,
  publishVisitStreakMilestone,
  postToAccountabilityWebhook,
};
