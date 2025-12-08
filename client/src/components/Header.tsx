import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Settings, Bell, LogOut, User } from "lucide-react";
import flowtechLogo from "@assets/Screenshot_2025-11-29_at_1.38.06_pm_1765196594766.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  title?: string;
}

export default function Header({ title = "Post Review" }: HeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b bg-background px-6 py-4">
      <Link href="/" className="flex items-center gap-3 hover-elevate active-elevate-2 rounded-md p-1 -m-1">
        <img src={flowtechLogo} alt="Flowtech" className="h-8 w-8 object-contain" />
        <h1 className="text-xl font-semibold" data-testid="text-page-title">{title}</h1>
      </Link>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" data-testid="button-notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setLocation("/settings")} data-testid="button-settings">
          <Settings className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-account-menu">
              <Avatar className="h-8 w-8" data-testid="avatar-user">
                <AvatarFallback className="text-xs">JD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">john.doe@example.com</p>
              </div>
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
            <DropdownMenuItem className="text-destructive" data-testid="menu-item-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
