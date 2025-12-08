import { useLocation } from "wouter";
import { ArrowLeft, Mail, Calendar, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/Header";

export default function Account() {
  const [, setLocation] = useLocation();
  const user = {
    name: "John Doe",
    email: "john.doe@example.com",
    initials: "JD",
    role: "Content Manager",
    joinDate: "January 2024",
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header title="Account" />
      
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
                <CardTitle className="text-lg">Profile</CardTitle>
                <CardDescription>
                  Your personal information and account details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-6">
                  <Avatar className="h-20 w-20" data-testid="avatar-profile">
                    <AvatarFallback className="text-2xl">{user.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold" data-testid="text-user-name">{user.name}</h3>
                        <p className="text-sm text-muted-foreground" data-testid="text-user-role">{user.role}</p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2" data-testid="button-edit-profile">
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span data-testid="text-user-email">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span data-testid="text-join-date">Member since {user.joinDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}
