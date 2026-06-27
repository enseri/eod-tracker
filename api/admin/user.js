const { getAdminFromRequest } = require('../../lib/auth');
const { setAdminTier, deleteUser, readStore } = require('../../lib/store');
const { summarizeUser } = require('../../lib/analytics');
const { clampSettingsForTier } = require('../../lib/tiers');
const { parseJsonBody } = require('../../lib/parse-body');
const { resolveWhopUsername, pickDisplayUsername } = require('../../lib/whop-username-sync');

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
      const tier = body?.tier;
      if (!targetId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }
      if (!tier) {
        res.status(400).json({ error: 'tier is required (basic or pro)' });
        return;
      }

      const result = await setAdminTier(companyId, targetId, tier);
      const store = result.store || { users: { [targetId]: result.user }, proUserIds: result.proUserIds };
      const summary = await summaryForUser(companyId, targetId, result.user, store);

      res.status(200).json({
        ok: true,
        tier,
        companyId,
        onProList: summary.tier === 'pro',
        proUserIds: result.proUserIds,
        summary,
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
