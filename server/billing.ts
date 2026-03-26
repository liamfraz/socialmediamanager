import Stripe from 'stripe';
import { PLANS } from '@shared/plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' });

/**
 * Maps a Stripe price ID back to the corresponding plan tier.
 * Returns 'free' if no match found.
 */
export function getPlanTierFromPriceId(priceId: string | null | undefined): 'free' | 'starter' | 'pro' {
  if (!priceId) return 'free';
  for (const [tier, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) {
      return tier as 'free' | 'starter' | 'pro';
    }
  }
  return 'free';
}

export { stripe };
