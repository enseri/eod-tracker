const { getAdminFromRequest } = require('../../lib/auth');
const { setAdminTier, deleteUser, readStore, updateUser } = require('../../lib/store');
const { summarizeUser } = require('../../lib/analytics');
const { clampSettingsForTier } = require('../../lib/tiers');
const { parseJsonBody } = require('../../lib/parse-body');
const { resolveWhopUsername, pickDisplayUsername } = require('../../lib/whop-username-sync');
const { applyVerification, applyRankOverride } = require('../../lib/income-verify');
const { publishIncomeRecords } = require('../../lib/eod-channel-publish');

async function resolveDisplayName(companyId, userId, record) {
  if (userId.startsWith('user_')) {
    const whopName = await resolveWhopUsername(userId, companyId, {
      storedUsername: record.username,
    });
    return pickDisplayUsername(userId, record.username, whopName);
  }
  return record.username || userId;
}

async function summaryForUser(companyId, userId, record, store) {
  let summary = summarizeUser(userId, record, store);
  if (userId.startsWith('user_')) {
    const whopName = await resolveWhopUsername(userId, companyId, {
      storedUsername: record.username,
    });
    summary = {
      ...summary,
      username: pickDisplayUsername(userId, record.username, whopName),
    };
  }
  return summary;
}

function truthy(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}

module.exports = async function handler(req, res) {
  try {
    const admin = await getAdminFromRequest(req);
    const companyId = admin.companyId;

    const userId = req.query.userId;

    if (req.method === 'DELETE') {
      const body = await parseJsonBody(req);
      const targetId = userId || body?.userId;
      if (!targetId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }
      await deleteUser(companyId, targetId);
      res.status(200).json({ ok: true, deleted: targetId, companyId });
      return;
    }

    if (req.method === 'PATCH' || req.method === 'POST') {
      const body = await parseJsonBody(req);
      const targetId = userId || body?.userId;
      if (!targetId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const tier = body?.tier;
      const hasIncomeVerified = Object.prototype.hasOwnProperty.call(body || {}, 'incomeVerified');
      const hasRankOverride = Object.prototype.hasOwnProperty.call(body || {}, 'rankOverride');

      if (!tier && !hasIncomeVerified && !hasRankOverride) {
        res.status(400).json({ error: 'Provide tier, incomeVerified, or rankOverride' });
        return;
      }

      const store0 = await readStore(companyId);
      const record0 = store0.users[targetId];
      if (!record0) {
        res.status(404).json({ error: 'Member not found — they need to submit an EOD first' });
        return;
      }

      let broadcasts = [];
      let channel = null;

      if (tier) {
        await setAdminTier(companyId, targetId, tier);
      }

      if (hasRankOverride) {
        const { patch } = applyRankOverride(body.rankOverride);
        await updateUser(companyId, targetId, patch);
      }

      if (hasIncomeVerified) {
        const fresh = (await readStore(companyId)).users[targetId] || record0;
        if (truthy(body.incomeVerified)) {
          const username = await resolveDisplayName(companyId, targetId, fresh);
          const result = applyVerification(fresh, { username });
          await updateUser(companyId, targetId, result.patch);
          broadcasts = result.broadcasts || [];
          if (broadcasts.length) {
            channel = await publishIncomeRecords({ username, broadcasts });
          }
        } else {
          await updateUser(companyId, targetId, { incomeVerified: false });
        }
      }

      const store = await readStore(companyId);
      const record = store.users[targetId] || record0;
      const summary = await summaryForUser(companyId, targetId, record, store);

      res.status(200).json({
        ok: true,
        tier: tier || summary.tier,
        companyId,
        onProList: summary.tier === 'pro',
        proUserIds: store.proUserIds || [],
        summary,
        broadcasts: broadcasts.map((b) => ({ type: b.type, label: b.label })),
        channel,
      });
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const store = await readStore(companyId);
    const record = store.users[userId];
    if (!record) {
      res.status(404).json({ error: 'Member not found — they need to submit an EOD first' });
      return;
    }

    const summary = await summaryForUser(companyId, userId, record, store);

    res.status(200).json({
      summary,
      companyId,
      entries: record.entries || {},
      visits: record.visits || [],
      settings: clampSettingsForTier(record.settings, summary.tier),
      onProList: summary.tier === 'pro',
      proUserIds: store.proUserIds || [],
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to load user detail' });
  }
};
