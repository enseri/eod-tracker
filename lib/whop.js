const { decodeJwtPayload } = require('./jwt-decode');

let WhopCtor;
let client;

function loadWhopCtor() {
  if (!WhopCtor) {
    const mod = require('@whop/sdk');
    WhopCtor = mod.default || mod.Whop || mod;
  }
  return WhopCtor;
}

async function loadWhopCtorAsync() {
  if (!WhopCtor) {
    const mod = await import('@whop/sdk');
    WhopCtor = mod.default || mod.Whop || mod;
  }
  return WhopCtor;
}

function normalizeApiKey(key) {
  if (!key) return key;
  const trimmed = key.trim();
  if (trimmed.startsWith('Bearer ')) return trimmed;
  return `Bearer ${trimmed}`;
}

function getWhopApiKey() {
  return (process.env.WHOP_API_KEY || '').trim() || null;
}

function getWhopAppId() {
  return (process.env.WHOP_APP_ID || process.env.WHO_APP_ID || '').trim() || null;
}

function getWhopCompanyId() {
  return (
    (process.env.WHOP_COMPANY_ID || '').trim() ||
    (process.env.DEFAULT_COMPANY_ID || '').trim() ||
    (process.env.LEGACY_STORE_COMPANY_ID || '').trim() ||
    null
  );
}

function isWhopCompanyId(id) {
  return typeof id === 'string' && /^(biz_|com_)/.test(id);
}

function resolveWhopCompanyId(companyId) {
  if (isWhopCompanyId(companyId)) return companyId;
  return getWhopCompanyId();
}

function hasWhopConfig() {
  return !!(getWhopApiKey() && getWhopAppId());
}

async function whopApiGet(path, query = {}) {
  const apiKey = getWhopApiKey();
  if (!apiKey) return null;
  const url = new URL(`https://api.whop.com/api/v1${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  });
  const res = await fetch(url.toString(), {
    headers: { Authorization: normalizeApiKey(apiKey) },
  });
  if (!res.ok) {
    const snippet = (await res.text().catch(() => '')).slice(0, 160);
    const err = new Error(`Whop API ${res.status}${snippet ? `: ${snippet}` : ''}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function whopApiRequest(method, path, body) {
  const apiKey = getWhopApiKey();
  if (!apiKey) throw new Error('Whop API key not configured');
  const url = `https://api.whop.com/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  const opts = {
    method,
    headers: {
      Authorization: normalizeApiKey(apiKey),
      'Content-Type': 'application/json',
    },
  };
  if (body != null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const snippet = (await res.text().catch(() => '')).slice(0, 200);
    const err = new Error(`Whop API ${res.status}${snippet ? `: ${snippet}` : ''}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function whopApiPost(path, body) {
  return whopApiRequest('POST', path, body);
}

async function whopApiPatch(path, body) {
  return whopApiRequest('PATCH', path, body);
}

function whopConfigError() {
  const missing = [];
  if (!getWhopApiKey()) missing.push('WHOP_API_KEY');
  if (!getWhopAppId()) {
    missing.push('WHOP_APP_ID (must start with app_, not the URL slug)');
  }
  if (!missing.length) return null;
  return `Whop is not configured on the server — add ${missing.join(' and ')} in Vercel → Settings → Environment Variables (Production), then redeploy.`;
}

function getWhopClient() {
  if (!hasWhopConfig()) {
    throw new Error('WHOP_API_KEY and WHOP_APP_ID must be set');
  }
  if (!client) {
    const Whop = loadWhopCtor();
    client = new Whop({
      apiKey: normalizeApiKey(getWhopApiKey()),
      appID: getWhopAppId(),
    });
  }
  return client;
}

async function getWhopClientAsync() {
  if (!hasWhopConfig()) {
    throw new Error('WHOP_API_KEY and WHOP_APP_ID must be set');
  }
  if (!client) {
    const Whop = await loadWhopCtorAsync();
    client = new Whop({
      apiKey: normalizeApiKey(getWhopApiKey()),
      appID: getWhopAppId(),
    });
  }
  return client;
}

function getWhopUserToken(req) {
  const h = req.headers || {};
  return h['x-whop-user-token'] || h['X-Whop-User-Token'] || null;
}

async function verifyWhopSession(req) {
  const token = getWhopUserToken(req);
  if (!token || !hasWhopConfig()) return null;
  try {
    const whop = await getWhopClientAsync();
    const verified = await whop.verifyUserToken(token, { dontThrow: true });
    if (!verified?.userId) return null;
    return { ...verified, token };
  } catch (err) {
    console.warn('verifyWhopSession failed:', err.message);
    return null;
  }
}

function explainWhopSessionFailure(token) {
  if (!token) {
    return 'Whop session required — open this app from inside Whop (not a direct browser tab).';
  }
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) {
    return 'Invalid Whop session token — close the app and reopen it from your Whop dashboard.';
  }

  const configured = getWhopAppId();
  const aud = typeof payload.aud === 'string' ? payload.aud : null;
  if (aud && configured && aud !== configured) {
    return `WHOP_APP_ID mismatch — Vercel has ${configured} but Whop sent ${aud}. In Vercel, set WHOP_APP_ID to ${aud} (from the app installed on this business), then redeploy.`;
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return 'Whop session expired — close and reopen the app from Whop.';
  }

  if (!hasWhopConfig()) {
    return whopConfigError();
  }

  return 'Invalid Whop session — ensure WHOP_API_KEY and WHOP_APP_ID are copied from the same app in Whop Developer, then redeploy.';
}

function sessionFailureFromRequest(req) {
  return explainWhopSessionFailure(getWhopUserToken(req));
}

async function fetchWhopUserProfile(userId, companyId) {
  if (!userId || !userId.startsWith('user_') || !hasWhopConfig()) return null;
  const whopCompany = resolveWhopCompanyId(companyId);

  try {
    const query = whopCompany ? { company_id: whopCompany } : {};
    return await whopApiGet(`/users/${userId}`, query);
  } catch (err) {
    console.warn(`fetchWhopUserProfile(${userId}) company=${whopCompany || 'none'}:`, err.message);
    if (!whopCompany) return null;
    try {
      return await whopApiGet(`/users/${userId}`);
    } catch (err2) {
      console.warn(`fetchWhopUserProfile(${userId}) fallback:`, err2.message);
      return null;
    }
  }
}

function whopDisplayName(profile, fallback) {
  if (!profile) return fallback || null;
  const username = typeof profile.username === 'string' ? profile.username.trim() : '';
  if (username) return username;
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  if (name) return name;
  return fallback || null;
}

async function isCompanyAdmin(userId, companyId) {
  if (!userId || !companyId || !hasWhopConfig()) return false;
  try {
    const access = await whopApiGet(`/users/${userId}/access/${companyId}`);
    return access.access_level === 'admin';
  } catch (err) {
    console.warn('isCompanyAdmin failed:', err.message);
    return false;
  }
}

async function isWhopAdmin(userId, { companyId, experienceId } = {}) {
  if (!userId || !hasWhopConfig()) return false;
  const resources = [companyId, experienceId].filter(Boolean);
  for (const resourceId of resources) {
    try {
      const access = await whopApiGet(`/users/${userId}/access/${resourceId}`);
      if (access.access_level === 'admin') return true;
    } catch (err) {
      console.warn(`checkAccess(${resourceId}) failed:`, err.message);
    }
  }
  return false;
}

function jwtAccessLevel(token) {
  const payload = decodeJwtPayload(token);
  return payload?.access_level || null;
}

async function verifyWhopToken(req) {
  const session = await verifyWhopSession(req);
  if (!session) {
    throw Object.assign(new Error('Invalid or expired Whop session'), { status: 401 });
  }
  return session;
}

module.exports = {
  hasWhopConfig,
  whopConfigError,
  getWhopApiKey,
  getWhopAppId,
  getWhopClient,
  getWhopClientAsync,
  whopApiGet,
  whopApiPost,
  whopApiPatch,
  getWhopUserToken,
  verifyWhopSession,
  explainWhopSessionFailure,
  sessionFailureFromRequest,
  fetchWhopUserProfile,
  whopDisplayName,
  getWhopCompanyId,
  isWhopCompanyId,
  resolveWhopCompanyId,
  isCompanyAdmin,
  isWhopAdmin,
  jwtAccessLevel,
  verifyWhopToken,
  decodeJwtPayload,
};
