import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Settings, LogOut, User } from "lucide-react";
import flowtechLogo from "@assets/Screenshot_2025-11-29_at_1.38.06_pm_1765271076550.png";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Header() {
  const [, setLocation] = useLocation();
  const [prepareDialogOpen, setPrepareDialogOpen] = useState(false);
  const [postCount, setPostCount] = useState("1");
  const [postTopics, setPostTopics] = useState<string[]>([""]);
  const { user, logout } = useAuth();

  const getInitials = (username: string) => {
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b bg-background px-6 py-4">
      <Link href="/" className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-md p-1 -m-1">
        <img src={flowtechLogo} alt="Flowtech" className="h-8 w-8 object-contain" />
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Flowtech Post Management</h1>
      </Link>
      
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setPrepareDialogOpen(true)} data-testid="button-prepare-posts">
          Prepare Posts
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} data-testid="button-settings">
          <Settings className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-account-menu">
              <Avatar className="h-8 w-8" data-testid="avatar-user">
                <AvatarFallback className="text-xs">{user ? getInitials(user.username) : "?"}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{user?.username || "Unknown"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/account")} data-testid="menu-item-account">
              <User className="mr-2 h-4 w-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-item-settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={logout} data-testid="menu-item-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={prepareDialogOpen} onOpenChange={(open) => {
        setPrepareDialogOpen(open);
        if (!open) {
          setPostCount("1");
          setPostTopics([""]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-prepare-dialog-title">Prepare Posts</DialogTitle>
            <DialogDescription>
              This will initiate the workflow with n8n to prepare your posts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="post-count">Number of posts to prepare</Label>
              <Select 
                value={postCount} 
                onValueChange={(value) => {
                  setPostCount(value);
                  const count = parseInt(value);
                  setPostTopics(prev => {
                    const newTopics = [...prev];
                    while (newTopics.length < count) newTopics.push("");
                    return newTopics.slice(0, count);
                  });
                }}
              >
                <SelectTrigger id="post-count" data-testid="select-post-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <SelectItem key={num} value={String(num)} data-testid={`select-item-count-${num}`}>
                      {num} {num === 1 ? "post" : "posts"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="max-h-60">
              <div className="space-y-3 pr-4">
                {Array.from({ length: parseInt(postCount) }).map((_, index) => (
                  <div key={index} className="space-y-1">
                    <Label htmlFor={`topic-${index}`}>Post {index + 1} topic</Label>
                    <Input
                      id={`topic-${index}`}
                      placeholder="e.g., weddings, flowers, business tips..."
                      value={postTopics[index] || ""}
                      onChange={(e) => {
                        const newTopics = [...postTopics];
                        newTopics[index] = e.target.value;
                        setPostTopics(newTopics);
                      }}
                      data-testid={`input-topic-${index}`}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Button 
            className="w-full" 
            onClick={() => {
              setPrepareDialogOpen(false);
              setPostCount("1");
              setPostTopics([""]);
            }}
            data-testid="button-confirm-prepare"
          >
            Confirm Prepare Posts
          </Button>
        </DialogContent>
      </Dialog>
    </header>
  );
}
