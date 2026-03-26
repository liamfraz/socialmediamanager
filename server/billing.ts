import Stripe from 'stripe';
import { PLANS } from '@shared/plans';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

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

/**
 * Creates a Stripe Checkout Session for a subscription with a 14-day free trial.
 * Card is always required upfront (payment_method_collection: 'always').
 * If the user has no Stripe customer yet, one is created and saved.
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  email: string
): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error('User not found');

  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    stripeCustomerId = customer.id;
    await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId));
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_collection: 'always',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { userId },
    },
    success_url:
      process.env.APP_BASE_URL + '/billing/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: process.env.APP_BASE_URL + '/pricing',
  });

  return session.url!;
}

/**
 * Creates a Stripe Customer Portal session so the user can manage their subscription.
 */
export async function createPortalSession(userId: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error('User not found');
  if (!user.stripeCustomerId) throw new Error('No Stripe customer for this account');

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: process.env.APP_BASE_URL + '/dashboard',
  });

  return session.url;
}

export { stripe };
