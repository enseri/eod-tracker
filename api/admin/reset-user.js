const { getAdminFromRequest } = require('../../lib/auth');
const { parseJsonBody } = require('../../lib/parse-body');
const { resetUserToSeedProfile } = require('../../lib/reset-user-seed');

module.exports = async function handler(req, res) {
  try {
    await getAdminFromRequest(req);

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = await parseJsonBody(req);
    const username = body?.username || req.query?.username;
    const userId = body?.userId || req.query?.userId;
    const profileKey = body?.profile || body?.profileKey || 'marcus';
    const dayCount = Number(body?.dayCount) || 92;

    if (!username && !userId) {
      res.status(400).json({ error: 'username or userId is required' });
      return;
    }

    const result = await resetUserToSeedProfile({
      username,
      userId,
      profileKey,
      dayCount,
    });

    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Reset failed' });
  }
};
