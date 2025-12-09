import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import ReviewPosts from "@/pages/ReviewPosts";
import PostedPosts from "@/pages/PostedPosts";
import PostDetail from "@/pages/PostDetail";
import Settings from "@/pages/Settings";
import Account from "@/pages/Account";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/review" component={ReviewPosts} />
      <Route path="/posted" component={PostedPosts} />
      <Route path="/post/:id" component={PostDetail} />
      <Route path="/settings" component={Settings} />
      <Route path="/account" component={Account} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between gap-4 border-b bg-background px-6 py-4">
                <h1 className="text-2xl font-bold" data-testid="text-app-title">Socials Post Manager</h1>
                <span className="text-sm text-muted-foreground" data-testid="text-account-name">John Doe</span>
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
