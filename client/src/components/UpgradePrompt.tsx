import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { Link } from "wouter";

interface UpgradePromptProps {
  feature?: string;
}

/**
 * Reusable component shown when a user hits a 402 response from a gated endpoint.
 * Links to the /pricing page so the user can upgrade.
 */
export function UpgradePrompt({ feature }: UpgradePromptProps) {
  const featureLabel = feature || "this feature";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">
            Upgrade to unlock {featureLabel}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Paid plans include AI post generation, bulk upload with duplicate
          detection, and more.
        </p>
        <Button asChild className="w-full" size="sm">
          <Link href="/pricing">View Plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
