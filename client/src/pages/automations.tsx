import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus,
  Bot,
  Play,
  Pause,
  Square,
  Eye,
  Edit,
  Trash2,
  Activity,
  Clock,
  Target
} from "lucide-react";

interface Automation {
  id: number;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'stopped';
  targetKeywords: string[];
  targetAccounts: string[];
  dailyLimit: number;
  createdAt: string;
  updatedAt: string;
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

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'active': return Play;
    case 'paused': return Pause;
    case 'stopped': return Square;
    case 'draft': return Edit;
    default: return Bot;
  }
};

export default function Automations() {
  const [, setLocation] = useLocation();
  const userToken = localStorage.getItem('xreplyguy_wallet');

  const { data: automations = [], isLoading, error } = useQuery({
    queryKey: ['/api/automations'],
    queryFn: async () => {
      if (!userToken) throw new Error('No authentication token');
      
      const response = await fetch('/api/automations', {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch automations');
      }
      
      const data = await response.json();
      return data.automations as Automation[];
    },
    enabled: !!userToken,
  });

  if (!userToken) {
    setLocation('/');
    return null;
  }

  const handleActionClick = async (automationId: number, action: 'start' | 'stop') => {
    try {
      const response = await fetch(`/api/automations/${automationId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      
      if (response.ok) {
        // Refresh the automations list
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
          <p className="text-gray-400">Loading automations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,6%)]">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">Automations</h1>
            <p className="text-gray-400 text-sm">Manage your Twitter automation fleet</p>
          </div>
          
          <Button
            onClick={() => setLocation("/dashboard/create-automation")}
            className="bg-[hsl(263,70%,50%)] hover:bg-[hsl(263,70%,60%)]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Automation
          </Button>
        </div>
      </header>

      <div className="p-6">
        {error && (
          <Card className="bg-red-500/10 border-red-500/20 mb-6">
            <CardContent className="pt-6">
              <p className="text-red-400">Failed to load automations. Please try again.</p>
            </CardContent>
          </Card>
        )}

        {automations.length === 0 ? (
          // Empty State
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardContent className="text-center py-12">
              <Bot className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Automations Yet</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Your automation arsenal is empty. Create your first automation to begin 
                dominating Twitter with precision strikes.
              </p>
              <Button
                onClick={() => setLocation("/dashboard/create-automation")}
                className="bg-[hsl(263,70%,50%)] hover:bg-[hsl(263,70%,60%)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Automation
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Automations Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {automations.map((automation) => {
              const StatusIcon = getStatusIcon(automation.status);
              
              return (
                <Card key={automation.id} className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)] hover:border-[hsl(263,70%,50%)]/30 transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className="h-5 w-5 text-[hsl(263,70%,50%)]" />
                        <CardTitle className="text-lg">{automation.name}</CardTitle>
                      </div>
                      <Badge className={getStatusColor(automation.status)}>
                        {automation.status.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Target className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-400">
                          {automation.targetKeywords?.length || 0} keywords
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Activity className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-400">
                          {automation.dailyLimit}/day
                        </span>
                      </div>
                    </div>

                    {/* Keywords Preview */}
                    {automation.targetKeywords && automation.targetKeywords.length > 0 && (
                      <div>
                        <div className="flex flex-wrap gap-1">
                          {automation.targetKeywords.slice(0, 3).map((keyword) => (
                            <Badge key={keyword} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {automation.targetKeywords.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{automation.targetKeywords.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-2">
                      {automation.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleActionClick(automation.id, 'stop')}
                          className="flex-1"
                        >
                          <Square className="h-4 w-4 mr-1" />
                          Stop
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleActionClick(automation.id, 'start')}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/dashboard/automations/${automation.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {automation.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLocation(`/dashboard/automations/${automation.id}/live`)}
                          className="text-[hsl(263,70%,50%)] border-[hsl(263,70%,50%)]/30"
                        >
                          Live
                        </Button>
                      )}
                    </div>

                    {/* Last Updated */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          Updated {new Date(automation.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}