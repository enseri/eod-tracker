const { fetchWhopUserProfile, whopDisplayName, hasWhopConfig } = require('./whop');

/** True when stored name is missing or looks like a Whop user id, not a real handle. */
function isStaleUsername(name, userId) {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (userId && trimmed === userId) return true;
  if (/^user_[a-z0-9_]+$/i.test(trimmed)) return true;
  return false;
}

/**
 * Resolve display username from Whop API (preferred) or non-stale stored value.
 */
async function resolveWhopUsername(userId, companyId, hints = {}) {
  const stored = hints.storedUsername;
  if (!userId?.startsWith('user_')) {
    return isStaleUsername(stored, userId) ? null : stored;
  }

  if (hasWhopConfig()) {
    const profile = await fetchWhopUserProfile(userId, companyId);
    const fromWhop = whopDisplayName(profile, null);
    if (fromWhop) return fromWhop;
  }

  return isStaleUsername(stored, userId) ? null : stored;
}

/**
 * Fetch latest Whop username and persist when it changed (or stored value is stale).
 */
async function syncWhopUsername(companyId, userId, hints = {}) {
  const resolved = await resolveWhopUsername(userId, companyId, hints);
  if (!resolved) return null;

  const stored = hints.storedUsername;
  if (!isStaleUsername(stored, userId) && stored === resolved) {
    return resolved;
  }

  const { updateUser } = require('./store');
  await updateUser(companyId, userId, { username: resolved });
  return resolved;
}

function pickDisplayUsername(userId, recordUsername, resolvedUsername) {
  if (resolvedUsername) return resolvedUsername;
  if (!isStaleUsername(recordUsername, userId)) return recordUsername;
  return userId;
}

module.exports = {
  isStaleUsername,
  resolveWhopUsername,
  syncWhopUsername,
  pickDisplayUsername,
};
