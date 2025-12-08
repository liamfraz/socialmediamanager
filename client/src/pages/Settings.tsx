import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, Moon, Sun, Globe, Shield, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/Header";

export default function Settings() {
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState("en");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Settings" />
      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setLocation("/")} data-testid="button-back-dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>

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
                  <Sun className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Appearance</CardTitle>
                </div>
                <CardDescription>
                  Customize how the app looks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium" htmlFor="dark-mode">
                      Dark Mode
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Use dark theme for the application
                    </p>
                  </div>
                  <Switch
                    id="dark-mode"
                    checked={darkMode}
                    onCheckedChange={setDarkMode}
                    data-testid="switch-dark-mode"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Language & Region</CardTitle>
                </div>
                <CardDescription>
                  Set your preferred language
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium" htmlFor="language">
                      Language
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Select your preferred language
                    </p>
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-40" data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en" data-testid="select-item-language-en">English</SelectItem>
                      <SelectItem value="es" data-testid="select-item-language-es">Spanish</SelectItem>
                      <SelectItem value="fr" data-testid="select-item-language-fr">French</SelectItem>
                      <SelectItem value="de" data-testid="select-item-language-de">German</SelectItem>
                    </SelectContent>
                  </Select>
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
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-change-password">
                  Change Password
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-two-factor">
                  Enable Two-Factor Authentication
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Help & Support</CardTitle>
                </div>
                <CardDescription>
                  Get help with using the app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-documentation">
                  Documentation
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" data-testid="button-contact-support">
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
