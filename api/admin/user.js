const { getAdminFromRequest } = require('../../lib/auth');
const { readStore, setAdminTier, deleteUser } = require('../../lib/store');
const { summarizeUser } = require('../../lib/analytics');
const { clampSettingsForTier } = require('../../lib/tiers');
const { parseJsonBody } = require('../../lib/parse-body');
const { resolveWhopUsername, pickDisplayUsername } = require('../../lib/whop-username-sync');
const { enrichUsersWithWhopNames } = require('../../lib/whop-usernames');

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
      const store = await readStore(companyId);
      const usersForSummary = await enrichUsersWithWhopNames(store.users, companyId);
      const record = usersForSummary[targetId];

      res.status(200).json({
        ok: true,
        tier,
        companyId,
        onProList: (result.proUserIds || []).includes(targetId),
        proUserIds: result.proUserIds,
        summary: summarizeUser(targetId, record, store),
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
    const usersForSummary = await enrichUsersWithWhopNames(store.users, companyId);
    const record = usersForSummary[userId];
    if (!record) {
      res.status(404).json({ error: 'Member not found — they need to submit an EOD first' });
      return;
    }

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

    res.status(200).json({
      summary,
      companyId,
      entries: record.entries || {},
      visits: record.visits || [],
      settings: clampSettingsForTier(record.settings, summary.tier),
      onProList: summary.onProList,
      proUserIds: store.proUserIds || [],
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to load user detail' });
  }
};
