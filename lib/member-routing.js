const { resolveResourceIds } = require('./company-resolve');
const {
  getWhopUserToken,
  verifyWhopSession,
  getWhopCompanyId,
  jwtAccessLevel,
} = require('./whop');
const { resolveTeamAccess } = require('./whop-roles');
const { decodeJwtPayload } = require('./jwt-decode');

function jwtAccessLevelFrom(req, jwtPayload) {
  return jwtPayload?.access_level || jwtAccessLevel(getWhopUserToken(req)) || null;
}

function adminDashboardPath(whopCompanyId) {
  if (whopCompanyId && /^biz_|^com_/.test(whopCompanyId)) {
    return `/dashboard/${encodeURIComponent(whopCompanyId)}`;
  }
  return '/dashboard/global';
}

function isDevAdminBypass(req) {
  if (process.env.DEV_ADMIN !== '1') return false;
  const secret = req.headers?.['x-admin-secret'] || req.headers?.['X-Admin-Secret'];
  if (secret && process.env.ADMIN_API_SECRET && secret === process.env.ADMIN_API_SECRET) {
    return true;
  }
  const q = req.query || {};
  return q.admin === '1' || q.admin === 'true';
}

function memberTrackerPath(experienceId, whopCompanyId) {
  const parts = [];
  if (experienceId) {
    parts.push(`/experiences/${encodeURIComponent(experienceId)}`);
  } else {
    parts.push('/');
  }
  const q = [];
  if (whopCompanyId) q.push(`companyId=${encodeURIComponent(whopCompanyId)}`);
  q.push('view=member');
  return parts[0] + '?' + q.join('&');
}

function wantsMemberView(req) {
  const q = req.query || {};
  return q.view === 'member' || q.stay === '1';
}

/**
 * Decide member-app routing: redirect team to dashboard, or stay on tracker.
 * Preview as public/hidden → JWT access_level customer/no_access → never redirect.
 */
async function resolveMemberRouting(req) {
  const { companyId: whopCompanyId, experienceId, jwtPayload } = resolveResourceIds(req);
  const forceMember = wantsMemberView(req);
  const accessLevel = jwtAccessLevelFrom(req, jwtPayload);
  const dashboardPath = adminDashboardPath(whopCompanyId || getWhopCompanyId());
  const trackerPath = memberTrackerPath(experienceId, whopCompanyId);

  if (isDevAdminBypass(req)) {
    return {
      canAccessDashboard: !forceMember,
      isAdmin: true,
      redirectTo: forceMember ? null : dashboardPath,
      whopRole: 'admin',
      whopRoleLabel: 'Dev Admin',
      accessLevel: 'admin',
      forceMemberView: forceMember,
      dashboardPath,
      trackerPath,
      previewMode: false,
    };
  }

  const token = getWhopUserToken(req);
  if (!token) {
    return {
      canAccessDashboard: false,
      isAdmin: false,
      redirectTo: null,
      accessLevel: null,
      forceMemberView: forceMember,
      dashboardPath,
      trackerPath,
    };
  }

  const payload = jwtPayload || decodeJwtPayload(token);
  const session = await verifyWhopSession(req);
  const userId = session?.userId || payload?.sub || payload?.user_id || null;

  let team = null;
  if (userId) {
    team = await resolveTeamAccess(userId, { companyId: whopCompanyId, experienceId });
  }

  const base = {
    whopRole: team?.role || null,
    whopRoleLabel: team?.roleLabel || null,
    accessLevel: accessLevel || team?.accessLevel || null,
    forceMemberView: forceMember,
    dashboardPath,
    trackerPath,
    previewMode: accessLevel === 'customer' || accessLevel === 'no_access',
  };

  if (forceMember) {
    return {
      ...base,
      canAccessDashboard: !!team?.canAccessDashboard,
      isAdmin: !!team?.canAccessDashboard,
      redirectTo: null,
    };
  }

  // Whop builder preview as public / hidden — honor simulated member access.
  if (accessLevel === 'customer' || accessLevel === 'no_access') {
    return {
      ...base,
      canAccessDashboard: false,
      isAdmin: false,
      redirectTo: null,
    };
  }

  // Preview as admin (JWT) or live team member with dashboard role.
  if (accessLevel === 'admin' || team?.canAccessDashboard) {
    return {
      ...base,
      canAccessDashboard: true,
      isAdmin: true,
      redirectTo: dashboardPath,
      previewMode: accessLevel === 'admin',
    };
  }

  return {
    ...base,
    canAccessDashboard: false,
    isAdmin: false,
    redirectTo: null,
  };
}

module.exports = {
  memberTrackerPath,
  wantsMemberView,
  resolveMemberRouting,
};
