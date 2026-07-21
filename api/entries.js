const { getUserFromRequest } = require('../lib/auth');
const { getUserRecord, updateUser, readStore, storageMode } = require('../lib/store');
const { clampSettingsForTier, stripEntryForTier, isProTier } = require('../lib/tiers');
const { resolveTierFromContext } = require('../lib/tier-resolve');
const { parseJsonBody } = require('../lib/parse-body');
const { resolveMemberContext } = require('../lib/company-resolve');
const { requireBusinessAccess } = require('../lib/business-access');
const { syncWhopUsername } = require('../lib/whop-username-sync');
const { publishEodToChannel } = require('../lib/eod-channel-publish');
const { calcStreak } = require('../lib/analytics');
const { detectOnSubmit, displayRank } = require('../lib/income-verify');

module.exports = async function handler(req, res) {
  try {
    await requireBusinessAccess(req);
    const { companyId } = await resolveMemberContext(req);
    const user = await getUserFromRequest(req);
    const record = (await getUserRecord(companyId, user.userId, { createIfMissing: false })) || {
      tier: 'basic',
      username: null,
      visits: [],
      entries: {},
      settings: { pairCount: 1, incomeStreams: [] },
      options: {},
    };
    const store = await readStore(companyId);
    const tier = resolveTierFromContext(user.userId, record, store, {
      planId: user.planId,
      devTier: user.source === 'dev' ? user.tier : null,
    });

    if (req.method === 'GET') {
      const existing = await getUserRecord(companyId, user.userId, { createIfMissing: false });
      res.status(200).json({
        entries: existing?.entries || {},
        visits: existing?.visits || [],
        settings: clampSettingsForTier(existing?.settings, tier),
        streakMilestoneNotifiedKeys: existing?.streakMilestoneNotifiedKeys || [],
        tier,
        userId: user.userId,
        companyId,
      });
      return;
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      const {
        date,
        entry,
        visits,
        settings,
        options,
        entries: bulkEntries,
        username,
        deleteEntryDates,
      } = body || {};
      const existing = (await getUserRecord(companyId, user.userId, { createIfMissing: false })) || {
        tier: 'basic',
        username: null,
        visits: [],
        entries: {},
        settings: { pairCount: 1, incomeStreams: [] },
        options: {},
      };

      const resolvedTier = resolveTierFromContext(user.userId, existing, store, {
        planId: user.planId,
        devTier: user.source === 'dev' ? user.tier : null,
      });

      let resolvedUsername = username || user.username || existing.username;
      if (user.source === 'whop' && user.userId.startsWith('user_')) {
        const fresh = await syncWhopUsername(companyId, user.userId, {
          storedUsername: existing.username,
        });
        if (fresh) resolvedUsername = fresh;
      }

      const patch = {
        username: resolvedUsername,
        tier: resolvedTier,
      };

      const merged = { ...(existing.entries || {}) };
      const previousEntry = date && existing?.entries?.[date] ? existing.entries[date] : null;

      if (bulkEntries && typeof bulkEntries === 'object') {
        Object.keys(bulkEntries).forEach((d) => {
          merged[d] = stripEntryForTier(bulkEntries[d], resolvedTier);
        });
      }
      if (date && entry) {
        merged[date] = stripEntryForTier(entry, resolvedTier);
      }
      const removedDates = Array.isArray(deleteEntryDates)
        ? deleteEntryDates.filter((d) => typeof d === 'string' && d)
        : [];
      removedDates.forEach((d) => {
        delete merged[d];
      });
      patch.entries = merged;
      if (removedDates.length) {
        patch.deleteEntryDates = removedDates;
      }

      if (Array.isArray(visits)) {
        patch.visits = visits;
      }

      if (settings) {
        patch.settings = clampSettingsForTier(settings, resolvedTier);
      }

      if (options && isProTier(resolvedTier)) {
        patch.options = options;
      }

      // Income records (total/monthly milestones + rank). A new record marks the
      // member "pending" and forces incomeVerified = false — nothing is broadcast
      // and no rank is granted until an admin verifies (see api/admin/user.js).
      const incomeSettings = patch.settings || existing.settings || {};
      if (date && entry && isProTier(resolvedTier)) {
        const detection = detectOnSubmit(existing, {
          entries: merged,
          date,
          broadcastTotalMilestones: !!incomeSettings.broadcastIncomeMilestones,
        });
        if (detection.changed) {
          Object.assign(patch, detection.patch);
        }
      }

      const updated = await updateUser(companyId, user.userId, patch);
      const entryCount = Object.keys(updated.entries || {}).length;
      const streakNotifications = updated.settings?.streakNotifications !== false;
      const visitStreak = calcStreak(updated.visits || []);

      // The separate streak-milestone chat post was removed (manager request):
      // the streak now lives inline in the daily EOD message with a tiered emoji.
      let channel = null;

      if (date && merged[date]?.publish) {
        channel = await publishEodToChannel({
          entry: merged[date],
          date,
          username: resolvedUsername,
          entries: updated.entries,
          isPro: isProTier(resolvedTier),
          previousEntry,
          visits: updated.visits,
          rank: displayRank(updated),
          streakNotifications,
        });
      }

      res.status(200).json({
        ok: true,
        savedAt: updated.updatedAt,
        userId: user.userId,
        companyId,
        entryCount,
        deletedDates: removedDates.length ? removedDates : undefined,
        storageMode: storageMode(),
        visitStreak,
        channel,
      });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Sync failed', code: err.code || null });
  }
};
