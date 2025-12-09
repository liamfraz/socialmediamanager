import { useState } from "react";
import { Bell, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Notifications</CardTitle>
              </div>
              <CardDescription>
                Configure how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium" htmlFor="push-notifications">
                    Push Notifications
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Receive push notifications for post updates
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={notifications}
                  onCheckedChange={setNotifications}
                  data-testid="switch-push-notifications"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium" htmlFor="email-notifications">
                    Email Notifications
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Get email updates when posts are approved or rejected
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  data-testid="switch-email-notifications"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Privacy & Security</CardTitle>
              </div>
              <CardDescription>
                Manage your security settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-change-password">
                Change Password
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
