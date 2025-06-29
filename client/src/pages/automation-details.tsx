import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft,
  Play,
  Square,
  Edit,
  Trash2,
  Eye,
  Activity,
  Target,
  MessageSquare,
  Clock,
  Settings,
  TrendingUp,
  AlertTriangle
} from "lucide-react";

interface AutomationAction {
  id: number;
  actionType: string;
  targetPostUrl?: string;
  targetUser?: string;
  content?: string;
  status: string;
  executedAt?: string;
  createdAt: string;
}

interface AutomationDetails {
  id: number;
  name: string;
  status: string;
  targetKeywords: string[];
  targetAccounts: string[];
  replyStyle?: string;
  customInstructions?: string;
  dailyLimit: number;
  activeHours?: string;
  createdAt: string;
  updatedAt: string;
  recentActions: AutomationAction[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'stopped': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'draft': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const getActionTypeColor = (actionType: string) => {
  switch (actionType) {
    case 'like': return 'text-red-400';
    case 'reply': return 'text-blue-400';
    case 'follow': return 'text-green-400';
    default: return 'text-gray-400';
  }
};

export default function AutomationDetails() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/dashboard/automations/:id");
  const userToken = localStorage.getItem('xreplyguy_wallet');
  const automationId = params?.id;

  const { data: automation, isLoading, error } = useQuery({
    queryKey: [`/api/automations/${automationId}`],
    queryFn: async () => {
      if (!userToken || !automationId) throw new Error('Missing authentication or automation ID');
      
      const response = await fetch(`/api/automations/${automationId}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch automation details');
      }
      
      const data = await response.json();
      return data.automation as AutomationDetails;
    },
    enabled: !!userToken && !!automationId,
  });

  if (!userToken) {
    setLocation('/');
    return null;
  }

  if (!match || !automationId) {
    setLocation('/dashboard/automations');
    return null;
  }

  const handleActionClick = async (action: 'start' | 'stop') => {
    try {
      const response = await fetch(`/api/automations/${automationId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error(`Failed to ${action} automation:`, error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[hsl(263,70%,50%)] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading automation details...</p>
        </div>
      </div>
    );
  }

  if (error || !automation) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Automation Not Found</h2>
          <p className="text-gray-400 mb-4">The automation you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => setLocation('/dashboard/automations')} variant="outline">
            Back to Automations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,6%)]">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard/automations")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Automations
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-xl font-semibold">{automation.name}</h1>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={getStatusColor(automation.status)}>
                  {automation.status.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-400">
                  Created {new Date(automation.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {automation.status === 'active' && (
              <Button
                size="sm"
                onClick={() => setLocation(`/dashboard/automations/${automationId}/live`)}
                className="bg-[hsl(263,70%,50%)] hover:bg-[hsl(263,70%,60%)]"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Live
              </Button>
            )}
            
            {automation.status === 'active' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleActionClick('stop')}
                className="text-red-400 border-red-400/30"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => handleActionClick('start')}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            )}
            
            <Button size="sm" variant="outline" disabled>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            
            <Button size="sm" variant="outline" className="text-red-400 border-red-400/30" disabled>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Daily Limit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{automation.dailyLimit}</div>
              <p className="text-xs text-gray-500">actions per day</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{automation.targetKeywords?.length || 0}</div>
              <p className="text-xs text-gray-500">target keywords</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{automation.targetAccounts?.length || 0}</div>
              <p className="text-xs text-gray-500">target accounts</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{automation.recentActions?.length || 0}</div>
              <p className="text-xs text-gray-500">total actions</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {automation.targetKeywords && automation.targetKeywords.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="h-4 w-4 text-gray-400" />
                    <Label className="text-sm font-medium">Target Keywords</Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {automation.targetKeywords.map((keyword) => (
                      <Badge key={keyword} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {automation.targetAccounts && automation.targetAccounts.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Target className="h-4 w-4 text-gray-400" />
                    <Label className="text-sm font-medium">Target Accounts</Label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {automation.targetAccounts.map((account) => (
                      <Badge key={account} variant="outline" className="text-xs">
                        {account}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <Label className="text-sm font-medium">Reply Style</Label>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {automation.replyStyle || 'default'}
                </Badge>
              </div>

              {automation.activeHours && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <Label className="text-sm font-medium">Active Hours</Label>
                  </div>
                  <span className="text-sm text-gray-300">{automation.activeHours}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Actions */}
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Recent Actions
              </CardTitle>
              <CardDescription>
                Latest automation activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(!automation.recentActions || automation.recentActions.length === 0) ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No actions yet</p>
                  <p className="text-xs text-gray-500">Actions will appear here when the automation is active</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {automation.recentActions.slice(0, 5).map((action) => (
                    <div key={action.id} className="flex items-center justify-between p-3 bg-[hsl(0,0%,6%)] rounded-lg border border-[hsl(0,0%,15%)]">
                      <div className="flex items-center space-x-3">
                        <Badge 
                          variant="outline" 
                          className={`${getActionTypeColor(action.actionType)} border-current/30 capitalize`}
                        >
                          {action.actionType}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">
                            {action.targetUser || 'Unknown target'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(action.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={action.status === 'completed' ? 'text-green-400 border-green-400/30' : 'text-yellow-400 border-yellow-400/30'}
                      >
                        {action.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Custom Instructions */}
        {automation.customInstructions && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Custom Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 whitespace-pre-wrap">{automation.customInstructions}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className}>{children}</span>;
}