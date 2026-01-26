import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Instagram, Link, Unlink, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface InstagramStatus {
  configured: boolean;
  connected: boolean;
  instagramUsername: string | null;
}

export default function Account() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Check for URL params from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");

    if (success) {
      setNotification({ type: "success", message: success });
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      setNotification({ type: "error", message: error });
      // Clear URL params
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Fetch Instagram status
  const { data: instagramStatus, isLoading: loadingStatus } = useQuery<InstagramStatus>({
    queryKey: ["instagram-status"],
    queryFn: async () => {
      const response = await fetch("/api/instagram/status", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch status");
      return response.json();
    },
  });

  // Connect Instagram mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/instagram/auth-url", { credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get auth URL");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Instagram OAuth
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => {
      setNotification({ type: "error", message: error.message });
    },
  });

  // Disconnect Instagram mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/instagram/disconnect", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instagram-status"] });
      setNotification({ type: "success", message: "Instagram account disconnected" });
    },
    onError: (error: Error) => {
      setNotification({ type: "error", message: error.message });
    },
  });

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  const handleConnectInstagram = () => {
    connectMutation.mutate();
  };

  const handleDisconnectInstagram = () => {
    if (confirm("Are you sure you want to disconnect your Instagram account?")) {
      disconnectMutation.mutate();
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Notification */}
        {notification && (
          <Alert variant={notification.type === "error" ? "destructive" : "default"}>
            {notification.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        )}

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20" data-testid="avatar-profile">
                <AvatarFallback className="text-2xl">
                  {user ? getInitials(user.username) : "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold" data-testid="text-user-name">
                  {user?.username || "Unknown"}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instagram Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Instagram className="h-5 w-5" />
              Instagram Connection
            </CardTitle>
            <CardDescription>
              Connect your Instagram Business or Creator account to post directly
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStatus ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : !instagramStatus?.configured ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Instagram integration is not configured. Contact your administrator to set up
                  INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET environment variables.
                </AlertDescription>
              </Alert>
            ) : instagramStatus?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
                      <Instagram className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          @{instagramStatus.instagramUsername || "Connected"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Connected
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        You can now post directly to Instagram
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectInstagram}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="mr-2 h-4 w-4" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Instagram Business or Creator account to publish posts directly from
                  this app. You'll need a Facebook Page connected to your Instagram account.
                </p>
                <Button
                  onClick={handleConnectInstagram}
                  disabled={connectMutation.isPending}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="mr-2 h-4 w-4" />
                  )}
                  Connect Instagram
                </Button>
                <p className="text-xs text-muted-foreground">
                  Requirements: Instagram Business or Creator account, connected to a Facebook Page
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
