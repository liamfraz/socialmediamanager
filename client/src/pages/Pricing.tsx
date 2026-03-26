import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { Link } from "wouter";

// Client-safe plan config — priceIds are omitted (resolved server-side by /api/billing/checkout)
const CLIENT_PLANS = [
  {
    tier: "free" as const,
    name: "Free",
    price: 0,
    features: ["5 posts/month", "1 connected account", "AI tagging"],
    recommended: false,
  },
  {
    tier: "starter" as const,
    name: "Starter",
    price: 19,
    features: [
      "50 posts/month",
      "2 connected accounts",
      "AI tagging",
      "Duplicate detection",
      "Bulk upload",
    ],
    recommended: true,
  },
  {
    tier: "pro" as const,
    name: "Pro",
    price: 49,
    features: [
      "Unlimited posts",
      "5 connected accounts",
      "All Starter features",
      "Image composition",
      "Priority support",
    ],
    recommended: false,
  },
];

type PaidTier = "starter" | "pro";

export default function Pricing() {
  const { planTier, isLoading } = useSubscription();
  const [loadingTier, setLoadingTier] = useState<PaidTier | null>(null);

  async function handleSubscribe(tier: PaidTier) {
    setLoadingTier(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Checkout error:", data.error);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error("Failed to start checkout:", err);
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Choose your plan</h1>
          <p className="mt-2 text-muted-foreground">
            Start with a 14-day free trial. No charges until your trial ends.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {CLIENT_PLANS.map((plan) => {
            const isCurrent = planTier === plan.tier;
            const isRecommended = plan.recommended;

            return (
              <Card
                key={plan.tier}
                className={`relative flex flex-col ${isRecommended ? "border-primary ring-1 ring-primary" : ""}`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge>Recommended</Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="mt-1">
                    {plan.price === 0 ? (
                      <span className="text-2xl font-bold">Free</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold">${plan.price}</span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-6">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {plan.tier === "free" ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={isCurrent || isLoading}
                      >
                        {isCurrent ? "Current Plan" : "Downgrade"}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={isRecommended ? "default" : "outline"}
                        disabled={isCurrent || isLoading || loadingTier !== null}
                        onClick={() => handleSubscribe(plan.tier as PaidTier)}
                      >
                        {loadingTier === plan.tier ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {isCurrent
                          ? "Current Plan"
                          : "Start Free Trial"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/account" className="underline underline-offset-4 hover:text-foreground">
            Manage your subscription
          </Link>
        </p>
      </div>
    </div>
  );
}
