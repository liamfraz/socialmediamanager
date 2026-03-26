import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Middleware that gates routes behind an active subscription.
 * Returns 402 with upgrade prompt data for free/expired users.
 * Calls next() for trialing/active users.
 */
export async function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  if (
    user.subscriptionStatus === "trialing" ||
    user.subscriptionStatus === "active"
  ) {
    next();
    return;
  }

  res.status(402).json({
    error: "Subscription required",
    upgradeUrl: "/pricing",
    currentPlan: user.planTier ?? "free",
  });
}
