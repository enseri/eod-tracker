const {
  hasWhopConfig,
  getWhopApiKey,
  getWhopAppId,
  getWhopClientAsync,
  whopApiGet,
  getWhopUserToken,
  explainWhopSessionFailure,
} = require('../lib/whop');
const { decodeJwtPayload } = require('../lib/jwt-decode');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const appId = getWhopAppId();
  const out = {
    whopConfigured: hasWhopConfig(),
    hasWhopApiKey: !!getWhopApiKey(),
    hasWhopAppId: !!appId,
    whopAppIdFormat: appId
      ? appId.startsWith('app_')
        ? 'ok'
        : 'invalid — use app_xxx from Whop, not the URL slug'
      : 'missing',
    apiKeyMatchesApp: null,
    appBaseUrl: null,
    tokenAud: null,
    tokenExpired: null,
    sessionHint: null,
  };

  if (hasWhopConfig()) {
    try {
      const app = await whopApiGet(`/apps/${appId}`);
      out.apiKeyMatchesApp = true;
      out.appBaseUrl = app.base_url || null;
      out.appName = app.name || null;
    } catch (err) {
      out.apiKeyMatchesApp = false;
      out.apiKeyError = 'WHOP_API_KEY cannot access WHOP_APP_ID — use the API key from the same Whop app.';
    }
  }

  const token = getWhopUserToken(req);
  if (token) {
    const payload = decodeJwtPayload(token);
    out.tokenAud = typeof payload?.aud === 'string' ? payload.aud : null;
    out.tokenExpired = !!(payload?.exp && payload.exp * 1000 < Date.now());
    out.sessionHint = explainWhopSessionFailure(token);
    if (out.tokenAud && appId && out.tokenAud !== appId) {
      out.fix = `Set WHOP_APP_ID=${out.tokenAud} in Vercel and redeploy.`;
    }
  }

  res.status(200).json(out);
};
