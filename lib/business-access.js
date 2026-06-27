/** Restrict app usage to members of the configured WHOP_COMPANY_ID business. */
const {
  resolveIncomingResourceIds,
  parseBusinessIdFromReferer,
} = require('./company-resolve');
const {
  getWhopCompanyId,
  isWhopCompanyId,
  hasWhopConfig,
  getWhopUserToken,
  verifyWhopSession,
  explainWhopSessionFailure,
  whopApiGet,
} = require('./whop');

const experienceCompanyCache = new Map();

function isDevBypass(req) {
  if (process.env.DEV_ADMIN !== '1') return false;
  const secret = req.headers?.['x-admin-secret'] || req.headers?.['X-Admin-Secret'];
  if (secret && process.env.ADMIN_API_SECRET && secret === process.env.ADMIN_API_SECRET) {
    return true;
  }
  const q = req.query || {};
  return q.admin === '1' || q.admin === 'true';
}

function configuredBusinessId() {
  const id = getWhopCompanyId();
  return isWhopCompanyId(id) ? id : null;
}

function configuredExperienceId() {
  const id = (process.env.WHOP_EXPERIENCE_ID || '').trim();
  return id.startsWith('exp_') ? id : null;
}

function businessLockEnabled() {
  return !!configuredBusinessId();
}

async function fetchExperienceCompanyId(experienceId) {
  if (!experienceId || !experienceId.startsWith('exp_') || !hasWhopConfig()) return null;
  if (experienceCompanyCache.has(experienceId)) return experienceCompanyCache.get(experienceId);

  try {
    const data = await whopApiGet(`/experiences/${experienceId}`);
    const companyId =
      data?.company?.id ||
      data?.company_id ||
      (typeof data?.company === 'string' ? data.company : null);
    const resolved = isWhopCompanyId(companyId) ? companyId : null;
    experienceCompanyCache.set(experienceId, resolved);
    return resolved;
  } catch (err) {
    console.warn(`fetchExperienceCompanyId(${experienceId}):`, err.message);
    experienceCompanyCache.set(experienceId, null);
    return null;
  }
}

async function fetchCompanyAccess(userId, companyId) {
  if (!userId || !companyId || !hasWhopConfig()) return null;
  try {
    return await whopApiGet(`/users/${userId}/access/${companyId}`);
  } catch (err) {
    console.warn(`fetchCompanyAccess(${userId}, ${companyId}):`, err.message);
    return null;
  }
}

function apiGrantsMembership(access) {
  return !!(access?.has_access && access.access_level && access.access_level !== 'no_access');
}

/**
 * Which Whop business the user is actually browsing from (not WHOP_COMPANY_ID env).
 */
async function resolveSessionBusinessId(req, incoming) {
  if (isWhopCompanyId(incoming.companyId)) return incoming.companyId;

  const referer = req.headers?.referer || req.headers?.Referer || '';
  const fromReferer = parseBusinessIdFromReferer(referer);
  if (fromReferer) return fromReferer;

  if (incoming.experienceId) {
    return await fetchExperienceCompanyId(incoming.experienceId);
  }

  return null;
}

/**
 * Verify the caller opened the app from WHOP_COMPANY_ID's community and has access there.
 */
async function assertBusinessAccess(req) {
  const requiredBiz = configuredBusinessId();
  const requiredExp = configuredExperienceId();
  const lock = businessLockEnabled();

  if (isDevBypass(req)) {
    return { ok: true, source: 'dev', businessId: requiredBiz };
  }

  if (!lock && !hasWhopConfig()) {
    return { ok: true, source: 'open', businessId: null };
  }

  const token = getWhopUserToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'whop_session_required',
      error: explainWhopSessionFailure(null),
    };
  }

  const session = await verifyWhopSession(req);
  if (!session?.userId) {
    return {
      ok: false,
      status: 401,
      code: 'whop_session_invalid',
      error: explainWhopSessionFailure(token),
    };
  }

  const incoming = resolveIncomingResourceIds(req);
  const jwtLevel = incoming.jwtPayload?.access_level || null;
  const sessionBiz = await resolveSessionBusinessId(req, incoming);

  if (!requiredBiz) {
    return {
      ok: false,
      status: 503,
      code: 'business_not_configured',
      error:
        'This app is not linked to a Whop business yet. Set WHOP_COMPANY_ID in Vercel environment variables.',
    };
  }

  if (requiredExp && incoming.experienceId && incoming.experienceId !== requiredExp) {
    return {
      ok: false,
      status: 403,
      code: 'wrong_business',
      error:
        'This app is installed on a different Whop business. Open it from the correct community — not your other Whop accounts.',
      businessId: requiredBiz,
      sessionBusinessId: sessionBiz,
    };
  }

  if (sessionBiz && sessionBiz !== requiredBiz) {
    return {
      ok: false,
      status: 403,
      code: 'wrong_business',
      error:
        'This app is installed on a different Whop business. Open it from the correct community — not your other Whop accounts.',
      businessId: requiredBiz,
      sessionBusinessId: sessionBiz,
    };
  }

  if (!sessionBiz && lock) {
    return {
      ok: false,
      status: 403,
      code: 'business_context_unknown',
      error:
        'Open this app from inside the Whop business where it is installed. Bookmarks, direct links, and other communities cannot access it.',
      businessId: requiredBiz,
    };
  }

  if (jwtLevel === 'no_access') {
    return {
      ok: false,
      status: 403,
      code: 'business_access_denied',
      error:
        'You do not have access to this business. Join the community on Whop to use the VIP EOD Tracker.',
      businessId: requiredBiz,
    };
  }

  const access = await fetchCompanyAccess(session.userId, requiredBiz);
  if (!apiGrantsMembership(access)) {
    return {
      ok: false,
      status: 403,
      code: 'business_access_denied',
      error:
        'You do not have access to this business. Join the community on Whop to use the VIP EOD Tracker.',
      businessId: requiredBiz,
    };
  }

  return {
    ok: true,
    source: 'whop',
    userId: session.userId,
    businessId: requiredBiz,
    sessionBusinessId: sessionBiz,
    accessLevel: access.access_level,
  };
}

async function requireBusinessAccess(req) {
  const result = await assertBusinessAccess(req);
  if (!result.ok) {
    const err = new Error(result.error);
    err.status = result.status || 403;
    err.code = result.code;
    throw err;
  }
  return result;
}

module.exports = {
  configuredBusinessId,
  configuredExperienceId,
  businessLockEnabled,
  resolveSessionBusinessId,
  fetchExperienceCompanyId,
  assertBusinessAccess,
  requireBusinessAccess,
};
