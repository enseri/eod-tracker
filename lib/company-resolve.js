/** Resolve Whop business id for storage and access checks. */
const { getWhopUserToken, isWhopCompanyId, getWhopCompanyId } = require('./whop');
const { decodeJwtPayload } = require('./jwt-decode');

const GLOBAL_COMPANY_ID = 'global';

function parseBusinessIdFromReferer(referer) {
  const ref = String(referer || '');
  if (!ref) return null;
  const patterns = [
    /\/dashboard\/(biz_[^/?&#]+)/,
    /\/dashboard\/(com_[^/?&#]+)/,
    /\/(biz_[a-zA-Z0-9_]+)(?:[/?#]|$)/,
    /\/(com_[a-zA-Z0-9_]+)(?:[/?#]|$)/,
    /[?&](?:company_id|companyId|biz_id|business_id)=(biz_[^&]+)/,
    /[?&](?:company_id|companyId|biz_id|business_id)=(com_[^&]+)/,
  ];
  for (const pattern of patterns) {
    const match = ref.match(pattern);
    if (match && isWhopCompanyId(match[1])) return match[1];
  }
  return null;
}

/** Request context only — never falls back to WHOP_COMPANY_ID env. */
function resolveIncomingResourceIds(req) {
  const q = req.query || {};
  let companyId =
    q.companyId || q.company_id || q.business_id || q.biz_id || null;
  let experienceId = q.experienceId || q.experience_id || q.exp || null;

  const rawUrl = String(req.url || '');
  const dashMatch = rawUrl.match(/\/dashboard\/([^/?&#]+)/);
  if (dashMatch && isWhopCompanyId(dashMatch[1])) companyId = dashMatch[1];

  const expMatch = rawUrl.match(/\/experiences\/([^/?&#]+)/);
  if (expMatch && String(expMatch[1]).startsWith('exp_')) experienceId = expMatch[1];

  const referer = req.headers?.referer || req.headers?.Referer || '';
  if (!companyId) companyId = parseBusinessIdFromReferer(referer);
  if (!experienceId) {
    const refExp = referer.match(/\/experiences\/([^/?&#]+)/);
    if (refExp && String(refExp[1]).startsWith('exp_')) experienceId = refExp[1];
  }

  const token = getWhopUserToken(req);
  const payload = token ? decodeJwtPayload(token) : null;
  if (payload) {
    for (const key of ['company_id', 'biz_id', 'business_id']) {
      if (!companyId && isWhopCompanyId(payload[key])) companyId = payload[key];
    }
    if (!experienceId && String(payload.experience_id || '').startsWith('exp_')) {
      experienceId = payload.experience_id;
    }
  }

  return { companyId: companyId || null, experienceId: experienceId || null, jwtPayload: payload };
}

function resolveResourceIds(req) {
  const incoming = resolveIncomingResourceIds(req);
  let { companyId, experienceId, jwtPayload } = incoming;

  if (!isWhopCompanyId(companyId)) {
    const envCo = getWhopCompanyId();
    if (isWhopCompanyId(envCo)) companyId = envCo;
  }

  if (!experienceId) {
    const envExp = (process.env.WHOP_EXPERIENCE_ID || '').trim();
    if (envExp.startsWith('exp_')) experienceId = envExp;
  }

  return { companyId, experienceId, jwtPayload };
}

function resolveStorageCompanyIdFromResourceIds({ companyId } = {}) {
  if (isWhopCompanyId(companyId)) return companyId;
  const envCo = getWhopCompanyId();
  if (isWhopCompanyId(envCo)) return envCo;
  return GLOBAL_COMPANY_ID;
}

async function resolveCompanyId(req) {
  const ids = resolveResourceIds(req);
  return resolveStorageCompanyIdFromResourceIds(ids);
}

async function resolveMemberContext(req) {
  const { companyId, experienceId } = resolveResourceIds(req);
  return {
    companyId: resolveStorageCompanyIdFromResourceIds({ companyId }),
    whopCompanyId: companyId || null,
    experienceId: experienceId || null,
  };
}

async function requireWhopResourceAccess(req) {
  /* Access enforced in lib/auth.js via Whop token + checkAccess. */
}

module.exports = {
  GLOBAL_COMPANY_ID,
  resolveCompanyId,
  resolveMemberContext,
  resolveResourceIds,
  resolveIncomingResourceIds,
  parseBusinessIdFromReferer,
  resolveStorageCompanyIdFromResourceIds,
  requireWhopResourceAccess,
};
