import { useQuery } from "@tanstack/react-query";

interface BillingStatus {
  subscriptionStatus: string | null;
  planTier: string | null;
  trialEndsAt: string | null;
}

/**
 * Hook that returns the current user's subscription status and plan tier.
 * Fetches from GET /api/billing/status.
 */
export function useSubscription() {
  const { data, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => {
      const res = await fetch("/api/billing/status");
      if (!res.ok) throw new Error("Failed to fetch billing status");
      return res.json();
    },
  });

  const subscriptionStatus = data?.subscriptionStatus ?? null;
  const planTier = data?.planTier ?? "free";
  const trialEndsAt = data?.trialEndsAt ?? null;
  const isActive =
    subscriptionStatus === "trialing" || subscriptionStatus === "active";

  return { subscriptionStatus, planTier, trialEndsAt, isLoading, isActive };
}
