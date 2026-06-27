const { getAdminFromRequest } = require('../../lib/auth');
const { parseJsonBody } = require('../../lib/parse-body');
const { seedMemberProfiles, seedBulkTestUsers } = require('../../lib/seed-test-apply');

module.exports = async function handler(req, res) {
  try {
    await getAdminFromRequest(req);

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const body = await parseJsonBody(req);
    const action = body?.action || 'members';

    if (action === 'members') {
      const result = await seedMemberProfiles({
        wipe: !!body?.wipe,
        dayCount: Number(body?.dayCount) || 92,
      });
      res.status(200).json({ ok: true, action, ...result });
      return;
    }

    if (action === 'bulk-test') {
      const result = await seedBulkTestUsers();
      res.status(200).json({ ok: true, action, ...result });
      return;
    }

    res.status(400).json({ error: 'Unknown action (use members or bulk-test)' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Seed failed' });
  }
};
