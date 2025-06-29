import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft,
  Square,
  Pause,
  Play,
  Eye,
  Activity,
  Zap,
  AlertTriangle,
  Monitor,
  MousePointer,
  Clock,
  MessageSquare,
  Heart,
  UserPlus,
  ExternalLink
} from "lucide-react";

interface LiveAction {
  id: string;
  type: 'like' | 'reply' | 'follow';
  target: string;
  content?: string;
  timestamp: Date;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export default function LiveAutomation() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/dashboard/automations/:id/live");
  const automationId = params?.id;
  
  const [isActive, setIsActive] = useState(true);
  const [liveActions, setLiveActions] = useState<LiveAction[]>([]);
  const [sessionUrl] = useState(`https://browser-session-placeholder.com/sess_${Date.now()}`);

  // Simulate live actions for demo
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const actionTypes: ('like' | 'reply' | 'follow')[] = ['like', 'reply', 'follow'];
      const randomType = actionTypes[Math.floor(Math.random() * actionTypes.length)];
      const targets = ['@techceo', '@devguru', '@startupfounder', '@airesearcher'];
      const randomTarget = targets[Math.floor(Math.random() * targets.length)];
      
      const newAction: LiveAction = {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: randomType,
        target: randomTarget,
        content: randomType === 'reply' ? 'Great insights! This aligns perfectly with our recent findings.' : undefined,
        timestamp: new Date(),
        status: 'pending'
      };

      setLiveActions(prev => [newAction, ...prev.slice(0, 19)]); // Keep last 20 actions

      // Simulate action progression
      setTimeout(() => {
        setLiveActions(prev => prev.map(action => 
          action.id === newAction.id 
            ? { ...action, status: 'executing' }
            : action
        ));
      }, 1000);

      setTimeout(() => {
        setLiveActions(prev => prev.map(action => 
          action.id === newAction.id 
            ? { ...action, status: Math.random() > 0.1 ? 'completed' : 'failed' }
            : action
        ));
      }, 3000);
    }, 8000); // New action every 8 seconds

    return () => clearInterval(interval);
  }, [isActive]);

  if (!match || !automationId) {
    setLocation('/dashboard/automations');
    return null;
  }

  const handleStop = () => {
    setIsActive(false);
  };

  const handlePause = () => {
    setIsActive(!isActive);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'like': return Heart;
      case 'reply': return MessageSquare;
      case 'follow': return UserPlus;
      default: return Activity;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'like': return 'text-red-400';
      case 'reply': return 'text-blue-400';
      case 'follow': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'executing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const completedActions = liveActions.filter(a => a.status === 'completed').length;
  const failedActions = liveActions.filter(a => a.status === 'failed').length;
  const successRate = liveActions.length > 0 ? Math.round((completedActions / liveActions.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,6%)]">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(`/dashboard/automations/${automationId}`)}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Details
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <h1 className="text-xl font-semibold">Live Command Center</h1>
              <Badge className={isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                {isActive ? 'ACTIVE' : 'PAUSED'}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePause}
              className={isActive ? "text-yellow-400 border-yellow-400/30" : "text-green-400 border-green-400/30"}
            >
              {isActive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isActive ? 'Pause' : 'Resume'}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleStop}
              className="text-red-400 border-red-400/30"
            >
              <Square className="h-4 w-4 mr-2" />
              Emergency Stop
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Alert */}
        <Alert className="border-[hsl(263,70%,50%)]/30 bg-[hsl(263,70%,50%)]/10">
          <Monitor className="h-4 w-4" />
          <AlertDescription>
            Live automation session is running. Monitor actions in real-time and use emergency stop if needed.
            <Button 
              variant="link" 
              className="p-0 h-auto ml-2 text-[hsl(263,70%,50%)]"
              onClick={() => window.open(sessionUrl, '_blank')}
            >
              View Browser Session
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Total Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{liveActions.length}</div>
              <p className="text-xs text-gray-500">since session start</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">{completedActions}</div>
              <p className="text-xs text-gray-500">successful actions</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{successRate}%</div>
              <p className="text-xs text-gray-500">completion rate</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-400">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{failedActions}</div>
              <p className="text-xs text-gray-500">failed attempts</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Browser Session */}
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Monitor className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Browser Session
              </CardTitle>
              <CardDescription>
                Live view of automation browser
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-[hsl(0,0%,6%)] rounded-lg border border-[hsl(0,0%,15%)] flex items-center justify-center">
                <div className="text-center">
                  <Monitor className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">Browser Session Preview</p>
                  <p className="text-xs text-gray-500 mb-4">
                    Real browser view would appear here
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(sessionUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Full Browser
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Actions Feed */}
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
                Live Actions Feed
              </CardTitle>
              <CardDescription>
                Real-time automation activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {liveActions.length === 0 ? (
                  <div className="text-center py-8">
                    <Zap className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">Waiting for actions...</p>
                    <p className="text-xs text-gray-500">Actions will appear here when automation is active</p>
                  </div>
                ) : (
                  liveActions.map((action) => {
                    const Icon = getActionIcon(action.type);
                    const actionColor = getActionColor(action.type);
                    
                    return (
                      <div key={action.id} className="flex items-start space-x-3 p-3 bg-[hsl(0,0%,6%)] rounded-lg border border-[hsl(0,0%,15%)]">
                        <Icon className={`h-5 w-5 mt-0.5 ${actionColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium capitalize">
                              {action.type} {action.target}
                            </p>
                            <Badge className={getStatusColor(action.status)}>
                              {action.status}
                            </Badge>
                          </div>
                          {action.content && (
                            <p className="text-xs text-gray-400 mb-1 truncate">
                              "{action.content}"
                            </p>
                          )}
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            <span>{action.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Monitoring */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <MousePointer className="mr-2 h-5 w-5 text-[hsl(263,70%,50%)]" />
              Performance Monitoring
            </CardTitle>
            <CardDescription>
              Real-time automation performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-400">
                  {isActive ? '~8s' : '∞'}
                </div>
                <p className="text-xs text-gray-500">Average Action Interval</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-400">
                  {isActive ? '~3s' : '0s'}
                </div>
                <p className="text-xs text-gray-500">Average Execution Time</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-purple-400">
                  {isActive ? 'Active' : 'Paused'}
                </div>
                <p className="text-xs text-gray-500">Current Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}