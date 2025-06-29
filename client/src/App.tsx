import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CreateAutomation from "@/pages/create-automation";
import Automations from "@/pages/automations";
import AutomationDetails from "@/pages/automation-details";
import LiveAutomation from "@/pages/live-automation";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import TestBrowser from "@/pages/test-browser";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/create-automation" component={CreateAutomation} />
      <Route path="/dashboard/automations" component={Automations} />
      <Route path="/dashboard/automations/:id" component={AutomationDetails} />
      <Route path="/dashboard/automations/:id/live" component={LiveAutomation} />
      <Route path="/dashboard/analytics" component={Analytics} />
      <Route path="/dashboard/settings" component={Settings} />
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
