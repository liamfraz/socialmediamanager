import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";

type PollState = "polling" | "success" | "timeout";

interface BillingStatus {
  subscriptionStatus: string | null;
  planTier: string | null;
  trialEndsAt: string | null;
}

export default function BillingSuccess() {
  const [pollState, setPollState] = useState<PollState>("polling");
  const attemptRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      if (attemptRef.current >= 10) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPollState("timeout");
        return;
      }

      attemptRef.current += 1;

      try {
        const res = await fetch("/api/billing/status");
        if (res.ok) {
          const data: BillingStatus = await res.json();
          if (
            data.subscriptionStatus === "trialing" ||
            data.subscriptionStatus === "active"
          ) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setPollState("success");
          }
        }
      } catch {
        // Ignore network errors — keep polling
      }
    };

    intervalRef.current = setInterval(poll, 1000);
    // Run immediately on mount too
    poll();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        {pollState === "polling" && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2 text-xl">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                Setting up your account...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We&apos;re confirming your subscription. This only takes a moment.
              </p>
            </CardContent>
          </>
        )}

        {pollState === "success" && (
          <>
            <CardHeader>
              <div className="flex justify-center mb-2">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-xl">Welcome! Your free trial has started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You have 14 days to explore all features.
              </p>
              <Button asChild className="w-full">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </>
        )}

        {pollState === "timeout" && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Your payment is being processed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This usually takes a few seconds. Check your dashboard shortly.
              </p>
              <Button asChild className="w-full">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
