const { getUserFromRequest, tierLabel, WHOP_TEAM_ROLES, roleLabel } = require('../lib/auth');
const { getUserRecord, updateUser, readStore, storageMode, defaultUser } = require('../lib/store');
const { resolveTierFromContext } = require('../lib/tier-resolve');
const { resolveCompanyId, resolveResourceIds } = require('../lib/company-resolve');
const { resolveMemberRouting } = require('../lib/member-routing');
const { requireBusinessAccess, configuredBusinessId } = require('../lib/business-access');
const { hasWhopConfig } = require('../lib/whop');
const { syncWhopUsername, pickDisplayUsername } = require('../lib/whop-username-sync');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    await requireBusinessAccess(req);

    const companyId = await resolveCompanyId(req);
    const { companyId: whopCompanyId, experienceId } = resolveResourceIds(req);
    const user = await getUserFromRequest(req);
    const routing = await resolveMemberRouting(req);

    const store = await readStore(companyId);
    const record = (await getUserRecord(companyId, user.userId)) || defaultUser();
    const tier = resolveTierFromContext(user.userId, record, store, {
      planId: user.planId,
      devTier: user.source === 'dev' ? user.tier : null,
    });

    let displayUsername = record.username;
    if (user.source === 'whop' && user.userId.startsWith('user_')) {
      const fresh = await syncWhopUsername(companyId, user.userId, {
        storedUsername: record.username,
      });
      displayUsername = pickDisplayUsername(user.userId, record.username, fresh);
    } else {
      displayUsername = pickDisplayUsername(user.userId, record.username, user.username);
    }

    if (tier !== record.tier) {
      await updateUser(companyId, user.userId, { tier });
    } else if (
      user.source !== 'whop' &&
      displayUsername &&
      displayUsername !== record.username
    ) {
      await updateUser(companyId, user.userId, { username: displayUsername });
    }

    res.status(200).json({
      userId: user.userId,
      companyId,
      whopCompanyId: whopCompanyId || null,
      experienceId: experienceId || null,
      tier,
      tierLabel: tierLabel(tier),
      isAdmin: routing.isAdmin,
      canAccessDashboard: routing.canAccessDashboard,
      redirectTo: routing.redirectTo,
      dashboardPath: routing.dashboardPath,
      trackerPath: routing.trackerPath,
      whopRole: routing.whopRole || user.whopRole || null,
      whopRoleLabel: routing.whopRoleLabel || user.whopRoleLabel || null,
      accessLevel: routing.accessLevel || user.accessLevel || null,
      previewMode: !!routing.previewMode,
      forceMemberView: !!routing.forceMemberView,
      teamRoles: WHOP_TEAM_ROLES.map((id) => ({ id, label: roleLabel(id) })),
      username: displayUsername || user.username || record.username,
      onProList: tier === 'pro',
      storageMode: storageMode(),
      source: user.source,
      whopConfigured: hasWhopConfig(),
      businessLock: !!configuredBusinessId(),
    });
  } catch (err) {
    console.error('/api/me error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Failed to load profile',
      code: err.code || null,
      whopConfigured: hasWhopConfig(),
      businessLock: !!configuredBusinessId(),
    });
  }
};
