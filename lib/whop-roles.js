/** Whop business team roles and dashboard access for the EOD admin panel. */

const { whopApiGet, hasWhopConfig, resolveWhopCompanyId } = require('./whop');

/** All roles Whop can assign to authorized team members. */
const WHOP_TEAM_ROLES = [
  'owner',
  'admin',
  'manager',
  'sales_manager',
  'moderator',
  'support',
  'advertiser',
  'app_manager',
  'custom',
];

/** Roles that can open the student-progress admin dashboard. */
const DASHBOARD_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'sales_manager',
  'moderator',
  'support',
  'app_manager',
  'custom',
]);

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Operations',
  manager: 'Manager',
  sales_manager: 'Sales',
  moderator: 'Moderator',
  support: 'Support',
  advertiser: 'Advertiser',
  app_manager: 'App Manager',
  custom: 'Custom',
};

function roleLabel(role) {
  if (!role) return null;
  return ROLE_LABELS[role] || role.replace(/_/g, ' ');
}

function roleCanAccessDashboard(role) {
  if (!role) return false;
  return DASHBOARD_ROLES.has(role);
}

async function checkResourceAccess(userId, resourceId) {
  if (!userId || !resourceId || !hasWhopConfig()) return null;
  try {
    return await whopApiGet(`/users/${userId}/access/${resourceId}`);
  } catch (err) {
    console.warn(`checkResourceAccess(${resourceId}):`, err.message);
    return null;
  }
}

async function fetchAuthorizedUserRole(userId, companyId) {
  const co = resolveWhopCompanyId(companyId);
  if (!userId || !co || !hasWhopConfig()) return null;
  try {
    const data = await whopApiGet('/authorized_users', {
      company_id: co,
      user_id: userId,
      first: 1,
    });
    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const row = rows[0];
    return row?.role || null;
  } catch (err) {
    console.warn(`fetchAuthorizedUserRole(${userId}, ${co}):`, err.message);
    return null;
  }
}

/**
 * Resolve whether a user is a team member with dashboard access for this business.
 * Uses checkAccess (admin level) plus authorized_users role when available.
 */
async function resolveTeamAccess(userId, { companyId, experienceId } = {}) {
  const co = resolveWhopCompanyId(companyId);
  let accessLevel = null;
  let hasAccess = false;

  for (const resourceId of [co, experienceId].filter(Boolean)) {
    const access = await checkResourceAccess(userId, resourceId);
    if (!access) continue;
    if (access.access_level) accessLevel = access.access_level;
    if (access.has_access) hasAccess = true;
    if (access.access_level === 'admin') break;
  }

  const isTeamMember = accessLevel === 'admin';
  let role = null;
  if (isTeamMember && co) {
    role = await fetchAuthorizedUserRole(userId, co);
  }

  const canAccessDashboard =
    isTeamMember && (role ? roleCanAccessDashboard(role) : true);

  return {
    accessLevel,
    hasAccess,
    isTeamMember,
    role,
    roleLabel: roleLabel(role),
    canAccessDashboard,
  };
}

module.exports = {
  WHOP_TEAM_ROLES,
  DASHBOARD_ROLES,
  ROLE_LABELS,
  roleLabel,
  roleCanAccessDashboard,
  fetchAuthorizedUserRole,
  resolveTeamAccess,
};
