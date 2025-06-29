import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Settings as SettingsIcon,
  User,
  Shield,
  Bell,
  CreditCard,
  LogOut,
  Save,
  AlertTriangle,
  Crown,
  Calendar,
  Wallet
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

const getTierDescription = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 'free': return 'Basic automation access with invitation';
    case 'starter': return 'Enhanced automation for growing accounts';
    case 'pro': return 'Professional-grade automation suite';
    case 'advanced': return 'Advanced features for power users';
    case 'enterprise': return 'Full-scale enterprise automation';
    default: return 'Custom automation tier';
  }
};

export default function Settings() {
  const [, setLocation] = useLocation();
  const userToken = localStorage.getItem('xreplyguy_wallet');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(false);

  const { data: userData, isLoading } = useQuery({
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

  const handleLogout = () => {
    localStorage.removeItem('xreplyguy_wallet');
    setLocation('/');
  };

  const truncateWallet = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  if (!userToken) {
    setLocation('/');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[hsl(263,70%,50%)] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,6%)]">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-gray-400 text-sm">Manage your account preferences and subscription</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Account Information */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
              Account Information
            </CardTitle>
            <CardDescription>
              Your account details and current subscription status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium text-gray-400">Wallet Address</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Wallet className="h-4 w-4 text-gray-400" />
                  <span className="font-mono text-sm">{userData ? truncateWallet(userData.walletAddress) : ''}</span>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-400">Account ID</Label>
                <div className="mt-1">
                  <span className="text-sm text-gray-300">#{userData?.id}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Details */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Crown className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
              Subscription Details
            </CardTitle>
            <CardDescription>
              Current tier and usage information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[hsl(0,0%,6%)] rounded-lg border border-[hsl(0,0%,15%)]">
              <div className="flex items-center space-x-3">
                <Crown className="h-8 w-8 text-[hsl(263,70%,50%)]" />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-semibold capitalize">{userData?.tier} Tier</h3>
                    <Badge className={getTierColor(userData?.tier || '')}>
                      {userData?.tier?.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400">{getTierDescription(userData?.tier || '')}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-bold">{userData?.dailyLimit}</div>
                <p className="text-xs text-gray-500">actions/day</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-[hsl(0,0%,6%)] rounded-lg border border-[hsl(0,0%,15%)]">
                <div className="text-lg font-semibold text-blue-400">{userData?.usageToday}</div>
                <p className="text-xs text-gray-500">Used Today</p>
              </div>
              
              <div className="text-center p-4 bg-[hsl(0,0%,6%)] rounded-lg border border-[hsl(0,0%,15%)]">
                <div className="text-lg font-semibold text-purple-400">{userData?.daysRemaining}</div>
                <p className="text-xs text-gray-500">Days Remaining</p>
              </div>
              
              <div className="text-center p-4 bg-[hsl(0,0%,6%)] rounded-lg border border-[hsl(0,0%,15%)]">
                <div className={`text-lg font-semibold ${userData?.isExpired ? 'text-red-400' : 'text-green-400'}`}>
                  {userData?.isExpired ? 'Expired' : 'Active'}
                </div>
                <p className="text-xs text-gray-500">Status</p>
              </div>
            </div>

            {userData?.subscriptionExpires && (
              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <Calendar className="h-4 w-4" />
                <span>
                  Subscription expires on {new Date(userData.subscriptionExpires).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Configure how you receive updates and alerts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Push Notifications</Label>
                <p className="text-xs text-gray-500">Receive real-time automation alerts</p>
              </div>
              <Button
                variant={notificationsEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              >
                {notificationsEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>
            
            <Separator className="bg-[hsl(0,0%,20%)]" />
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Email Alerts</Label>
                <p className="text-xs text-gray-500">Weekly performance summaries</p>
              </div>
              <Button
                variant={emailAlerts ? "default" : "outline"}
                size="sm"
                onClick={() => setEmailAlerts(!emailAlerts)}
                disabled
              >
                {emailAlerts ? "Enabled" : "Disabled"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
              Security Settings
            </CardTitle>
            <CardDescription>
              Account security and authentication options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-5 w-5 text-green-400" />
                <h4 className="font-medium text-green-400">Wallet Authentication Active</h4>
              </div>
              <p className="text-sm text-gray-400">
                Your account is secured with Phantom wallet authentication. Only you can access this account with your wallet.
              </p>
            </div>
            
            <Alert className="border-yellow-500/20 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-400">
                Advanced security features are coming soon. Enable 2FA and session management for enhanced protection.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Billing Information */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
              Billing Information
            </CardTitle>
            <CardDescription>
              Subscription and payment details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-blue-500/20 bg-blue-500/10">
              <AlertTriangle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-400">
                Your subscription is managed through private invitation codes. Contact support for tier upgrades or billing questions.
              </AlertDescription>
            </Alert>
            
            <div className="text-center py-8">
              <CreditCard className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invitation-Based Access</h3>
              <p className="text-gray-400 mb-4 max-w-md mx-auto">
                Your current tier was activated with an invitation code. Future billing features will be available here.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="bg-[hsl(0,0%,8%)] border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center text-red-400">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
              <div>
                <Label className="text-sm font-medium text-red-400">Logout from Account</Label>
                <p className="text-xs text-gray-500">Sign out and clear local session data</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-red-400 border-red-400/30 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}