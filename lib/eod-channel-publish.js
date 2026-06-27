const { formatEodChannelMessage } = require('./eod-channel-format');
const { calcSubmissionStreak } = require('./eod-submission-streak');
const { getStreakMilestone } = require('./streak-milestones');

function getAccountabilityWebhookUrl() {
  const url =
    (process.env.WHOP_ACCOUNTABILITY_WEBHOOK_URL || '').trim() ||
    (process.env.WHOP_CHAT_WEBHOOK_URL || '').trim() ||
    '';
  return url.startsWith('http') ? url : null;
}

async function publishEodToChannel({ entry, date, username, entries, isPro }) {
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

  const streak = calcSubmissionStreak(entries, date);
  const content = formatEodChannelMessage({
    entry,
    date,
    username,
    streak,
    isPro,
  });
  const milestone = getStreakMilestone(streak);
  const handle = username ? String(username).replace(/^@/, '') : 'Member';
  const webhookUsername = `${handle} — EOD`;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: webhookUsername,
        content,
      }),
    });

    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).slice(0, 160);
      throw new Error(`Webhook ${res.status}${snippet ? `: ${snippet}` : ''}`);
    }

    return {
      ok: true,
      webhook: true,
      streak,
      milestone,
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

module.exports = {
  getAccountabilityWebhookUrl,
  publishEodToChannel,
};
