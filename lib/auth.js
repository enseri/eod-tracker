const { isProTier } = require('./tiers');
const { decodeJwtPayload } = require('./jwt-decode');
const { resolveCompanyId, resolveResourceIds, resolveIncomingResourceIds } = require('./company-resolve');
const { resolveTeamAccess, roleLabel, WHOP_TEAM_ROLES } = require('./whop-roles');
const { assertBusinessAccess, configuredBusinessId, fetchExperienceCompanyId } = require('./business-access');
const {
  getWhopUserToken,
  verifyWhopSession,
  explainWhopSessionFailure,
  jwtAccessLevel,
  fetchWhopUserProfile,
  whopDisplayName,
  hasWhopConfig,
} = require('./whop');

function isProduction() {
  return process.env.VERCEL_ENV === 'production';
}

function isDevAdminAllowed() {
  return process.env.DEV_ADMIN === '1';
}

/** Local/scripts only — never grants admin in production without Whop. */
function isDevAdminBypass(req) {
  if (!isDevAdminAllowed()) return false;
  const secret = req.headers?.['x-admin-secret'] || req.headers?.['X-Admin-Secret'];
  if (secret && process.env.ADMIN_API_SECRET && secret === process.env.ADMIN_API_SECRET) {
    return true;
  }
  const q = req.query || {};
  return q.admin === '1' || q.admin === 'true';
}

function devAdminFromQuery(q) {
  if (!isDevAdminAllowed()) return false;
  return q?.admin === '1' || q?.admin === 'true';
}

function resolveTierFromPayload(payload) {
  if (!payload) return null;
  if (payload.tier === 'pro' || payload.tier === 'basic') return payload.tier;
  const proPlans = (process.env.WHOP_PRO_PLAN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const planId = payload.plan_id || payload.planId;
  if (planId && proPlans.includes(planId)) return 'pro';
  return null;
}

function jwtAccessLevelFrom(req, jwtPayload) {
  return jwtPayload?.access_level || jwtAccessLevel(getWhopUserToken(req)) || null;
}

/**
 * Admin for dashboard API routes: JWT admin when not previewing as member,
 * plus team role via checkAccess + authorized_users.
 */
async function isDashboardAdmin(userId, req, jwtPayload) {
  if (!userId) return false;
  const level = jwtAccessLevelFrom(req, jwtPayload);
  if (level === 'customer' || level === 'no_access') return false;
  if (level === 'admin') return true;
  const { companyId, experienceId } = resolveResourceIds(req);
  const team = await resolveTeamAccess(userId, { companyId, experienceId });
  return !!team.canAccessDashboard;
}

async function resolveAdminAccess(req) {
  if (isDevAdminBypass(req)) {
    const q = req.query || {};
    return {
      ok: true,
      userId: q.userId || q.user_id || 'dev_admin',
      username: q.username || 'Dev Admin',
      source: 'dev',
      companyId: await resolveCompanyId(req),
    };
  }

  const token = getWhopUserToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: explainWhopSessionFailure(null),
    };
  }

  const business = await assertBusinessAccess(req);
  if (!business.ok) {
    return {
      ok: false,
      status: business.status || 403,
      error: business.error,
      code: business.code,
    };
  }

  const session = await verifyWhopSession(req);
  if (!session?.userId) {
    return {
      ok: false,
      status: 401,
      error: explainWhopSessionFailure(token),
    };
  }

  const { companyId, experienceId, jwtPayload } = resolveResourceIds(req);
  const requiredBiz = configuredBusinessId();
  if (requiredBiz) {
    const incoming = resolveIncomingResourceIds(req);
    const sessionBiz = incoming.companyId || (incoming.experienceId
      ? await fetchExperienceCompanyId(incoming.experienceId)
      : null);
    if (sessionBiz && sessionBiz !== requiredBiz) {
      return {
        ok: false,
        status: 403,
        code: 'wrong_business',
        error:
          'This admin dashboard only works for the Whop business where the app is installed.',
      };
    }
  }
  const isAdmin = await isDashboardAdmin(session.userId, req, jwtPayload);
  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      error:
        'Admin access required. Open the dashboard from your Whop business as a team member, or use Preview as admin in the app builder.',
    };
  }

  let username =
    jwtPayload?.username ||
    jwtPayload?.name ||
    null;
  if (!username && session.userId.startsWith('user_')) {
    const profile = await fetchWhopUserProfile(session.userId, companyId);
    username = whopDisplayName(profile, null);
  }

  return {
    ok: true,
    userId: session.userId,
    username: username || session.userId,
    source: 'whop',
    companyId: await resolveCompanyId(req),
    whopCompanyId: companyId,
    experienceId,
    whopRole: (await resolveTeamAccess(session.userId, { companyId, experienceId })).role,
  };
}

async function getUserFromRequest(req) {
  const q = req.query || {};
  const devUserId = q.userId || q.user_id;
  const devTier = q.tier === 'pro' ? 'pro' : q.tier === 'basic' ? 'basic' : null;
  const token = getWhopUserToken(req);

  if (token) {
    const payload = decodeJwtPayload(token);
    const userId = payload?.sub || payload?.user_id || payload?.userId || devUserId || 'unknown_user';
    const tier = resolveTierFromPayload(payload) || devTier || 'basic';
    const planId = payload?.plan_id || payload?.planId || null;
    const accessLevel = jwtAccessLevelFrom(req, payload);
    const { companyId, experienceId } = resolveResourceIds(req);

    let team = null;
    if (userId.startsWith('user_')) {
      team = await resolveTeamAccess(userId, { companyId, experienceId });
    }

    const previewAsMember = accessLevel === 'customer' || accessLevel === 'no_access';
    const isAdmin =
      isDevAdminBypass(req) ||
      (!previewAsMember && (accessLevel === 'admin' || !!team?.canAccessDashboard));

    return {
      userId,
      tier,
      planId,
      isAdmin,
      accessLevel,
      whopRole: team?.role || null,
      whopRoleLabel: team?.roleLabel || null,
      canAccessDashboard: isDevAdminBypass(req) || (!previewAsMember && !!team?.canAccessDashboard),
      username: payload?.username || payload?.name || null,
      source: 'whop',
    };
  }

  return {
    userId: devUserId || 'dev_user',
    tier: devTier || process.env.DEFAULT_TIER || 'basic',
    planId: null,
    isAdmin: isDevAdminBypass(req),
    accessLevel: null,
    username: q.username || 'Dev User',
    source: 'dev',
  };
}

async function getAdminFromRequest(req) {
  const result = await resolveAdminAccess(req);
  if (!result.ok) {
    const err = new Error(result.error);
    err.status = result.status;
    throw err;
  }
  return {
    userId: result.userId,
    username: result.username,
    isAdmin: true,
    source: result.source,
    companyId: result.companyId,
    whopCompanyId: result.whopCompanyId || null,
    experienceId: result.experienceId || null,
    whopRole: result.whopRole || null,
  };
}

function requireAdmin(user) {
  if (!user?.isAdmin) {
    const err = new Error('Admin access required');
    err.status = 403;
    throw err;
  }
}

function tierLabel(tier) {
  return isProTier(tier) ? 'Pro' : 'Basic';
}

function adminDashboardPath(whopCompanyId) {
  if (whopCompanyId && /^biz_|^com_/.test(whopCompanyId)) {
    return `/dashboard/${encodeURIComponent(whopCompanyId)}`;
  }
  return '/dashboard/global';
}

module.exports = {
  getUserFromRequest,
  getAdminFromRequest,
  resolveAdminAccess,
  requireAdmin,
  tierLabel,
  adminDashboardPath,
  decodeJwtPayload,
  isProduction,
  isDevAdminAllowed,
  devAdminFromQuery,
  isDevAdminBypass,
  WHOP_TEAM_ROLES,
  roleLabel,
};
