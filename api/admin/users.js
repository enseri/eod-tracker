const { getAdminFromRequest, adminDashboardPath, roleLabel } = require('../../lib/auth');
const { readStore, storageMode, deleteUsers } = require('../../lib/store');
const { summarizeAll } = require('../../lib/analytics');
const { enrichUsersWithWhopNames } = require('../../lib/whop-usernames');
const { parseJsonBody } = require('../../lib/parse-body');
const { APP_VERSION } = require('../../lib/version');
const { memberTrackerPath } = require('../../lib/member-routing');
const { MONTHLY_RANKS } = require('../../lib/income-ranks');

async function deleteMany(companyId, userIds) {
  return deleteUsers(companyId, userIds);
}

module.exports = async function handler(req, res) {
  try {
    const admin = await getAdminFromRequest(req);
    const companyId = admin.companyId;

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body?.action === 'delete') {
        const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];
        if (!userIds.length) {
          res.status(400).json({ error: 'userIds array is required' });
          return;
        }
        await deleteMany(companyId, userIds);
        res.status(200).json({ ok: true, deleted: userIds.length, userIds });
        return;
      }
      res.status(400).json({ error: 'Unknown action' });
      return;
    }

    if (req.method === 'DELETE') {
      const body = await parseJsonBody(req);
      const qIds = String(req.query.userIds || req.query.userId || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const userIds = Array.isArray(body?.userIds) ? body.userIds.filter(Boolean) : qIds;
      if (!userIds.length) {
        res.status(400).json({ error: 'userIds required (body or ?userIds=a,b)' });
        return;
      }
      await deleteMany(companyId, userIds);
      res.status(200).json({ ok: true, deleted: userIds.length, userIds });
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const store = await readStore(companyId);
    const usersForSummary = await enrichUsersWithWhopNames(store.users, companyId);
    const summary = summarizeAll(usersForSummary, store);

    res.status(200).json({
      ...summary,
      companyId,
      proUserIds: store.proUserIds || [],
      ranks: MONTHLY_RANKS,
      storageMode: storageMode(),
      generatedAt: new Date().toISOString(),
      version: APP_VERSION,
      dashboardPath: adminDashboardPath(admin.whopCompanyId),
      trackerPath: memberTrackerPath(admin.experienceId, admin.whopCompanyId),
      experienceId: admin.experienceId || null,
      whopCompanyId: admin.whopCompanyId || null,
      adminUser: {
        userId: admin.userId,
        username: admin.username,
        whopRole: admin.whopRole || null,
        whopRoleLabel: roleLabel(admin.whopRole) || null,
      },
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to load admin data' });
  }
};
