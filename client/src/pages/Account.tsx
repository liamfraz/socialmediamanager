import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

export default function Account() {
  const { user } = useAuth();
  
  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
            <CardDescription>
              Your account details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20" data-testid="avatar-profile">
                <AvatarFallback className="text-2xl">{user ? getInitials(user.username) : "?"}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold" data-testid="text-user-name">{user?.username || "Unknown"}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
