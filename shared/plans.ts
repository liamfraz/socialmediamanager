export const PLANS = {
  free: {
    tier: 'free' as const,
    name: 'Free',
    price: 0,
    priceId: null,
    features: ['5 posts/month', '1 connected account', 'AI tagging'],
  },
  starter: {
    tier: 'starter' as const,
    name: 'Starter',
    price: 19,
    priceId: process.env.STRIPE_STARTER_PRICE_ID ?? null,
    features: ['50 posts/month', '2 connected accounts', 'AI tagging', 'Duplicate detection', 'Bulk upload'],
  },
  pro: {
    tier: 'pro' as const,
    name: 'Pro',
    price: 49,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
    features: ['Unlimited posts', '5 connected accounts', 'All Starter features', 'Image composition', 'Priority support'],
  },
} as const;

export type PlanTier = keyof typeof PLANS;
