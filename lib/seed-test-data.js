const SEED_PREFIX = 'seed_test_';

const BULK_TEST_IDS = ['seed_bulk_alpha', 'seed_bulk_beta', 'seed_bulk_gamma'];

const MEMBER_PROFILES = [
  {
    id: 'seed_test_marcus_chen',
    username: 'Marcus Chen',
    tier: 'pro',
    pairCount: 3,
    actions: [
      { name: 'Post IG reel', target: 2 },
      { name: 'Send outreach DMs', target: 25 },
      { name: 'Record Loom training', target: 1 },
    ],
    kpis: [
      { name: 'Qualified calls booked', target: 3 },
      { name: 'New email subscribers', target: 15 },
      { name: 'Implementation tasks closed', target: 5 },
    ],
    incomeStreams: [
      { id: 'is_impl', name: 'Implementation calls' },
      { id: 'is_vip', name: 'VIP upsell offers' },
      { id: 'is_astro', name: 'Astrology chart readings' },
    ],
    reflections: [
      'Strong outreach day — booked two discovery calls from the reel CTA.',
      'KPI lagged because I spent extra time refining the onboarding doc.',
      'Income beat target; VIP upsell landed from a warm DM thread.',
      'Paused midday for chart prep — still hit minimum action counts.',
      'Team sync ran long; caught up on DMs after dinner.',
    ],
  },
  {
    id: 'seed_test_sofia_alvarez',
    username: 'Sofia Alvarez',
    tier: 'pro',
    pairCount: 2,
    actions: [
      { name: 'Publish YouTube short', target: 1 },
      { name: 'Comment on niche posts', target: 20 },
    ],
    kpis: [
      { name: 'Sales conversations', target: 4 },
      { name: 'Content pieces shipped', target: 2 },
    ],
    incomeStreams: [
      { id: 'is_course', name: 'Course enrollments' },
      { id: 'is_coaching', name: '1:1 coaching packages' },
    ],
    reflections: [
      'YouTube short performed well — repurposed hook for email.',
      'Comments felt scattered; tightening my target account list tomorrow.',
      'Closed a coaching package after follow-up sequence.',
      'Light day intentionally — focus on offer rewrite.',
    ],
  },
  {
    id: 'seed_test_jordan_blake',
    username: 'Jordan Blake',
    tier: 'pro',
    pairCount: 3,
    actions: [
      { name: 'Whop community post', target: 1 },
      { name: 'Client check-in calls', target: 4 },
      { name: 'Update SOP library', target: 2 },
    ],
    kpis: [
      { name: 'Members helped in chat', target: 12 },
      { name: 'Testimonials collected', target: 1 },
      { name: 'Pipeline follow-ups', target: 8 },
    ],
    incomeStreams: [
      { id: 'is_whop', name: 'Whop membership renewals' },
      { id: 'is_done4u', name: 'Done-for-you setup fees' },
      { id: 'is_retainer', name: 'Monthly retainers' },
    ],
    reflections: [
      'Community engagement spiked after sharing a client win thread.',
      'SOP updates took longer than planned but unblocked VA work.',
      'Retainer renewal confirmed — documented process in Notion.',
      'Missed evening block; still logged partial progress.',
    ],
  },
  {
    id: 'seed_test_priya_nair',
    username: 'Priya Nair',
    tier: 'pro',
    pairCount: 2,
    actions: [
      { name: 'Live implementation session', target: 1 },
      { name: 'Review member EODs', target: 10 },
    ],
    kpis: [
      { name: 'Action items cleared', target: 6 },
      { name: 'Referrals requested', target: 3 },
    ],
    incomeStreams: [
      { id: 'is_group', name: 'Group program seats' },
      { id: 'is_intensive', name: 'Implementation intensives' },
    ],
    reflections: [
      'Live session ran 90 minutes — high energy, strong attendance.',
      'Caught two members slipping on KPIs; scheduled accountability pings.',
      'Referral ask felt awkward but produced one warm intro.',
    ],
  },
  {
    id: 'seed_test_eli_washington',
    username: 'Eli Washington',
    tier: 'basic',
    pairCount: 1,
    actions: [{ name: 'Daily implementation block', target: 1 }],
    kpis: [{ name: 'Core habit completed', target: 1 }],
    incomeStreams: [],
    reflections: [
      'Kept it simple — one focused block on offer positioning.',
      'Struggled with distraction; still logged the habit.',
      'Good momentum building on morning routine.',
    ],
  },
];

const BULK_TEST_PROFILES = [
  { id: 'seed_bulk_alpha', username: 'Bulk Alpha' },
  { id: 'seed_bulk_beta', username: 'Bulk Beta' },
  { id: 'seed_bulk_gamma', username: 'Bulk Gamma' },
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function buildOptions(profile) {
  const options = {};
  for (let i = 0; i < profile.pairCount; i++) {
    options[`action_${i}`] = profile.actions.map((a) => ({ name: a.name, target: a.target }));
    options[`kpi_${i}`] = profile.kpis.map((k) => ({ name: k.name, target: k.target }));
  }
  return options;
}

function buildUserRecord(profile, dayCount = 90) {
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const start = addDays(today, -(dayCount - 1));
  const entries = {};
  const visits = [];

  for (let i = 0; i < dayCount; i++) {
    const d = addDays(start, i);
    const ds = isoDate(d);
    const dow = d.getUTCDay();
    const skipWeekend = dow === 0 && i % 3 === 0;
    const skipRandom = i % 11 === 7;
    if (skipWeekend || skipRandom) continue;

    visits.push(ds);
    const pairs = [];
    for (let p = 0; p < profile.pairCount; p++) {
      const action = profile.actions[p] || profile.actions[0];
      const kpi = profile.kpis[p] || profile.kpis[0];
      pairs.push({
        action: action.name,
        actionCount: randBetween(Math.max(0, action.target - 3), action.target + 2),
        actionTarget: action.target,
        kpi: kpi.name,
        kpiCount: randBetween(Math.max(0, kpi.target - 4), kpi.target + 3),
        kpiTarget: kpi.target,
      });
    }

    const incomeStreams =
      profile.tier === 'pro'
        ? profile.incomeStreams.map((s, idx) => ({
            name: s.name,
            sales: randBetween(0, 3),
            income: randBetween(200, 2800) + idx * 120,
          }))
        : [];

    entries[ds] = {
      pairs,
      incomeStreams,
      reflection: pick(profile.reflections, i),
      publish: i % 5 === 0,
      hideEod: false,
      hideIncome: i % 13 === 0,
      submittedAt: new Date(d.getTime() + 18 * 3600000).toISOString(),
    };
  }

  return {
    tier: profile.tier,
    adminTier: profile.tier,
    username: profile.username,
    visits,
    entries,
    settings: {
      pairCount: profile.pairCount,
      incomeStreams:
        profile.tier === 'pro'
          ? profile.incomeStreams.map((s) => ({ id: s.id, name: s.name }))
          : [],
    },
    options: buildOptions(profile),
    createdAt: isoDate(start),
    updatedAt: new Date().toISOString(),
  };
}

function buildBulkTestUser(id, username) {
  const profile = {
    id,
    username,
    tier: 'pro',
    pairCount: 1,
    actions: [{ name: 'Outreach block', target: 3 }],
    kpis: [{ name: 'Replies', target: 8 }],
    incomeStreams: [{ id: 'is1', name: 'Consulting' }],
    reflections: [`Bulk delete test user ${username}.`],
  };
  return buildUserRecord(profile, 5);
}

module.exports = {
  SEED_PREFIX,
  BULK_TEST_IDS,
  MEMBER_PROFILES,
  BULK_TEST_PROFILES,
  buildUserRecord,
  buildBulkTestUser,
};
