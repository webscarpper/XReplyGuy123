import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Zap, 
  Settings, 
  LifeBuoy, 
  LogOut, 
  Activity,
  AlertTriangle,
  Clock,
  Users,
  BarChart3,
  Bot
} from "lucide-react";

interface UserData {
  id: number;
  walletAddress: string;
  tier: string;
  dailyLimit: number;
  usageToday: number;
  subscriptionExpires: string;
  daysRemaining: number;
  isExpired: boolean;
}

const getTierColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'free': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'starter': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'pro': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'advanced': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'enterprise': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const truncateWallet = (address: string) => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  // Get user data from localStorage (set during login)
  const userToken = localStorage.getItem('xreplyguy_wallet');

  const { data: userData, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      if (!userToken) throw new Error('No authentication token');
      
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }
      
      const data = await response.json();
      return data.user as UserData;
    },
    enabled: !!userToken,
  });

  useEffect(() => {
    if (!userToken) {
      setLocation('/');
      return;
    }
    
    if (userData) {
      setCurrentUser(userData);
    }
  }, [userData, userToken, setLocation]);

  const handleLogout = () => {
    localStorage.removeItem('xreplyguy_wallet');
    setLocation('/');
  };

  if (!userToken) {
    return null; // Will redirect
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[hsl(263,70%,50%)]"></div>
          <p className="mt-4 text-gray-400">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  if (error || !currentUser) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Authentication Error</h2>
          <p className="text-gray-400 mb-4">Unable to load user data. Please log in again.</p>
          <Button onClick={handleLogout} variant="outline">Return to Login</Button>
        </div>
      </div>
    );
  }

  const usagePercentage = (currentUser.usageToday / currentUser.dailyLimit) * 100;

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,6%)]">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[hsl(263,70%,50%)] to-[hsl(187,100%,42%)] bg-clip-text text-transparent">
              XReplyGuy
            </h1>
            <div className="text-sm text-gray-400">Command Center</div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="flex items-center space-x-2">
                <Badge className={getTierColor(currentUser.tier)}>
                  {currentUser.tier.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-400">
                  {truncateWallet(currentUser.walletAddress)}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {currentUser.isExpired ? (
                  <span className="text-red-400">Subscription Expired</span>
                ) : (
                  <span>{currentUser.daysRemaining} days remaining</span>
                )}
              </div>
            </div>
            
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-[hsl(0,0%,6%)] border-r border-[hsl(0,0%,20%)] h-[calc(100vh-81px)]">
          <nav className="p-4 space-y-2">
            <Button variant="ghost" className="w-full justify-start bg-[hsl(263,70%,50%)]/10 text-[hsl(263,70%,50%)]">
              <Activity className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start text-gray-400 hover:text-white">
              <Bot className="mr-2 h-4 w-4" />
              Automations
            </Button>
            <Button variant="ghost" className="w-full justify-start text-gray-400 hover:text-white">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
            <Separator className="my-4 bg-[hsl(0,0%,20%)]" />
            <Button variant="ghost" className="w-full justify-start text-gray-400 hover:text-white">
              <Settings className="mr-2 h-4 w-4" />
              Account Settings
            </Button>
            <Button variant="ghost" className="w-full justify-start text-gray-400 hover:text-white">
              <LifeBuoy className="mr-2 h-4 w-4" />
              Elite Support
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 space-y-6">
          {/* Welcome Section */}
          <div>
            <h2 className="text-3xl font-bold mb-2">
              Welcome back, Elite Operator
            </h2>
            <p className="text-gray-400">
              Your {currentUser.tier} tier command center is ready for deployment.
            </p>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Account Status */}
            <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">Account Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tier</span>
                    <Badge className={getTierColor(currentUser.tier)}>
                      {currentUser.tier.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status</span>
                    <span className={currentUser.isExpired ? "text-red-400" : "text-green-400"}>
                      {currentUser.isExpired ? "Expired" : "Active"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Expires</span>
                    <span className="text-sm text-gray-400">
                      {new Date(currentUser.subscriptionExpires).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Today */}
            <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">Usage Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-2xl font-bold">
                    {currentUser.usageToday}
                    <span className="text-sm text-gray-400 font-normal">
                      /{currentUser.dailyLimit}
                    </span>
                  </div>
                  <div className="w-full bg-[hsl(0,0%,15%)] rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[hsl(263,70%,50%)] to-[hsl(187,100%,42%)] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400">
                    {Math.round(usagePercentage)}% of daily limit used
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-400">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  className="w-full bg-[hsl(263,70%,50%)] hover:bg-[hsl(263,70%,60%)] text-white"
                  disabled
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Create Automation
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full border-[hsl(0,0%,30%)] hover:bg-[hsl(0,0%,10%)]"
                  disabled
                >
                  <Users className="mr-2 h-4 w-4" />
                  View Live Sessions
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Dashboard Content */}
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Command Center Overview
              </CardTitle>
              <CardDescription>
                Your automation command center is ready for deployment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Bot className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Active Automations</h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  Your elite automation suite is ready. Create your first automation to begin 
                  dominating Twitter with military precision.
                </p>
                <Button 
                  className="bg-[hsl(263,70%,50%)] hover:bg-[hsl(263,70%,60%)] text-white"
                  disabled
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Deploy First Automation
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}