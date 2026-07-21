const { formatEodChannelMessage } = require('./eod-channel-format');
const { calcStreak } = require('./analytics');
const { detectPersonalBests } = require('./personal-bests');

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
  rank = null,
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
  const handle = username ? String(username).replace(/^@/, '') : 'Member';

  // Personal bests are annotated INLINE in the EOD post as "(new best)" rather
  // than sent as a separate, clunky message (manager request).
  const records = detectPersonalBests({ entry, entries, date, isPro, previousEntry });
  const content = formatEodChannelMessage({
    entry,
    date,
    username,
    isPro,
    rank,
    streak,
    records,
  });

  try {
    await postToAccountabilityWebhook(webhookUrl, `${handle} — EOD`, content);
    return {
      ok: true,
      webhook: true,
      streak,
      personalBests: { inlined: true, records },
    };
  } catch (err) {
    console.error('publishEodToChannel webhook failed:', err.message);
    return {
      ok: false,
      error: err.message || 'Failed to post to accountability chat webhook',
      streak,
    };
  }
}

/**
 * Post income-record broadcasts (total milestone, monthly milestone, new rank)
 * after an admin verifies. `broadcasts` come from lib/income-verify applyVerification.
 */
async function publishIncomeRecords({ username, broadcasts }) {
  const list = (broadcasts || []).filter((b) => b && b.content);
  if (!list.length) return { skipped: true, reason: 'no_records', posted: [] };

  const webhookUrl = getAccountabilityWebhookUrl();
  if (!webhookUrl) {
    return { skipped: true, reason: 'no_webhook', posted: [] };
  }

  const handle = username ? String(username).replace(/^@/, '') : 'Member';
  const posted = [];
  for (const b of list) {
    const nameTag = b.type === 'rank' ? `${handle} — Rank` : `${handle} — Record`;
    try {
      await postToAccountabilityWebhook(webhookUrl, nameTag, b.content);
      posted.push({ type: b.type, ok: true });
    } catch (err) {
      console.error('publishIncomeRecords failed:', err.message);
      posted.push({ type: b.type, ok: false, error: err.message });
    }
  }
  return { ok: posted.some((p) => p.ok), posted };
}

module.exports = {
  getAccountabilityWebhookUrl,
  publishEodToChannel,
  publishIncomeRecords,
  postToAccountabilityWebhook,
};
