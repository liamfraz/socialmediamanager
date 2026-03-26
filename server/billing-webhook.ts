import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe, getPlanTierFromPriceId } from './billing';
import { db } from './db';
import { stripeEvents, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  let userId: string | undefined;

  // First try metadata
  if (subscription.metadata?.userId) {
    userId = subscription.metadata.userId;
  } else {
    // Look up user by stripeCustomerId
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

    if (customerId) {
      const result = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.stripeCustomerId, customerId))
        .limit(1);
      userId = result[0]?.id;
    }
  }

  if (!userId) {
    console.warn('[billing-webhook] syncSubscription: could not resolve userId for subscription', subscription.id);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const planTier = getPlanTierFromPriceId(priceId);

  await db.update(users)
    .set({
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      planTier,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
      currentPeriodEndsAt: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,
    })
    .where(eq(users.id, userId));
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string;
  const rawBody = (req as any).rawBody as Buffer;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Idempotency check — skip if already processed
  const existing = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.eventId, event.id))
    .limit(1);

  if (existing.length > 0) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  // Record the event BEFORE processing
  await db.insert(stripeEvents).values({
    eventId: event.id,
    type: event.type,
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
        const userId = session.metadata?.userId;

        if (userId && customerId && subscriptionId) {
          await db.update(users)
            .set({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
            })
            .where(eq(users.id, userId));

          // Retrieve full subscription and sync
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;

        if (customerId) {
          await db.update(users)
            .set({ subscriptionStatus: 'past_due' })
            .where(eq(users.stripeCustomerId, customerId));
        }
        break;
      }

      default:
        // Unhandled event type — no action needed
        break;
    }
  } catch (err) {
    console.error('[billing-webhook] Error processing event', event.type, err);
    // Still return 200 to avoid Stripe retries for non-retriable errors
  }

  res.status(200).json({ received: true });
}
