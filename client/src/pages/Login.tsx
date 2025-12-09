import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import flowtechLogo from "@assets/Screenshot_2025-11-29_at_1.38.06_pm_1765271076550.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      if (username === "liam" && password === "Password") {
        setLocation("/dashboard");
      } else {
        alert("Invalid username or password");
      }
    }, 300);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      <img 
        src={flowtechLogo} 
        alt="" 
        className="absolute w-[800px] h-[800px] object-contain opacity-[0.03] pointer-events-none select-none"
        aria-hidden="true"
      />
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <img 
            src={flowtechLogo} 
            alt="Flowtech Advisory" 
            className="mx-auto h-16 w-16 object-contain mb-2"
          />
          <CardTitle className="text-2xl" data-testid="text-login-title">
            Flowtech Advisory
          </CardTitle>
          <CardDescription data-testid="text-login-description">
            Sign in to manage your social media posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                data-testid="input-username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
