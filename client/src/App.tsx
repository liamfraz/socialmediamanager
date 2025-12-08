import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import PostDetail from "@/pages/PostDetail";
import Settings from "@/pages/Settings";
import Account from "@/pages/Account";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/post/:id" component={PostDetail} />
      <Route path="/settings" component={Settings} />
      <Route path="/account" component={Account} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
