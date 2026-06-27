const { resolveWhopUsername } = require('./whop-username-sync');
const { patchUserFields } = require('./store');

async function enrichUsersWithWhopNames(users, companyId) {
  const ids = Object.keys(users || {}).filter((id) => id.startsWith('user_'));
  if (!ids.length) return users;

  const next = { ...users };
  const patches = {};

  await Promise.all(
    ids.map(async (id) => {
      const resolved = await resolveWhopUsername(id, companyId, {
        storedUsername: users[id]?.username,
      });
      if (!resolved) return;
      if (resolved !== users[id]?.username) {
        patches[id] = { username: resolved };
      }
      next[id] = { ...next[id], username: resolved };
    }),
  );

  if (Object.keys(patches).length) {
    try {
      await patchUserFields(companyId, patches);
    } catch (err) {
      console.warn('persist Whop usernames failed:', err.message);
    }
  }

  return next;
}

async function enrichSummariesWithWhopNames(summaries, companyId) {
  if (!summaries?.length) return summaries;

  return Promise.all(
    summaries.map(async (row) => {
      if (!row.userId?.startsWith('user_')) return row;
      const resolved = await resolveWhopUsername(row.userId, companyId, {
        storedUsername: row.username,
      });
      if (!resolved || resolved === row.username) return row;
      return { ...row, username: resolved };
    }),
  );
}

module.exports = { enrichUsersWithWhopNames, enrichSummariesWithWhopNames };
