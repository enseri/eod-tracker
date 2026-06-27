function resolveTierFromContext(userId, record, store, context) {
  const proIds = store?.proUserIds || [];

  if (record?.adminTier === 'basic') return 'basic';
  if (record?.adminTier === 'pro' || proIds.includes(userId)) return 'pro';

  const proPlans = (process.env.WHOP_PRO_PLAN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (context?.planId && proPlans.includes(context.planId)) return 'pro';
  if (context?.devTier === 'pro' || context?.devTier === 'basic') return context.devTier;

  return 'basic';
}

module.exports = { resolveTierFromContext };
