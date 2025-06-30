import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Globe,
  Play,
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  Monitor,
  Mouse,
  Keyboard
} from "lucide-react";

interface BrowserStatus {
  isConnected: boolean;
  isStreaming?: boolean;
  currentUrl?: string;
  title?: string;
  browserEndpoint?: string;
  connectedClients?: number;
}

export default function TestBrowser() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<BrowserStatus>({ isConnected: false });
  const [loading, setLoading] = useState(false);
  const [navigateUrl, setNavigateUrl] = useState("https://twitter.com");
  const [isStreaming, setIsStreaming] = useState(false);
  const [manualControlEnabled, setManualControlEnabled] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [clickIndicator, setClickIndicator] = useState<{x: number, y: number, id: number} | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Test Automation State
  const [automationRunning, setAutomationRunning] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<string>('');
  const [automationProgress, setAutomationProgress] = useState<number>(0);
  const [twitterUsername, setTwitterUsername] = useState<string>('');
  const [twitterPassword, setTwitterPassword] = useState<string>('');
  const [automationStep, setAutomationStep] = useState<number>(0);
  const [automationTotalSteps, setAutomationTotalSteps] = useState<number>(8);
  const [automationMessage, setAutomationMessage] = useState<string>('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualInspectUrl, setManualInspectUrl] = useState<string>('');
  const [manualInstructions, setManualInstructions] = useState<string>('');
  const [automationComplete, setAutomationComplete] = useState(false);
  const [automationError, setAutomationError] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<string>('');

  const userToken = localStorage.getItem('xreplyguy_wallet');

  if (!userToken) {
    setLocation('/');
    return null;
  }

  // Test Automation Helper Functions
  const resetAutomationState = () => {
    setAutomationRunning(false);
    setAutomationStatus('');
    setAutomationProgress(0);
    setAutomationStep(0);
    setAutomationMessage('');
    setShowManualModal(false);
    setManualInspectUrl('');
    setManualInstructions('');
    setAutomationComplete(false);
    setAutomationError('');
    setEstimatedTime('');
  };

  // Check status on component mount
  useEffect(() => {
    checkStatus();
    setupWebSocket();
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Setup WebSocket connection for live streaming
  const setupWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/browser`;
      
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('Browser WebSocket connected');
        setWsConnected(true);
        setWs(websocket);
      };
      
      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'browser_frame') {
            setLiveFrame(`data:image/jpeg;base64,${message.data}`);
          } else if (message.type === 'live_frame') {
            setLiveFrame(message.frame);
            // Automatically activate streaming when we receive live frames during automation
            if (!isStreaming) {
              setIsStreaming(true);
            }
          } else if (message.type === 'live_view_url') {
            setLiveViewUrl(message.url);
            setIframeLoaded(false);
            setIframeError(false);
            console.log('Received live view URL:', message.url);
          } else if (message.type === 'control_feedback') {
            // Show click indicator
            if (message.action === 'click') {
              const id = Date.now();
              setClickIndicator({ x: message.x, y: message.y, id });
              setTimeout(() => setClickIndicator(null), 1000);
            }
          } else if (message.type === 'automation_status') {
            setAutomationStatus(message.status);
            setAutomationMessage(message.message);
            setAutomationStep(message.step);
            setAutomationTotalSteps(message.totalSteps);
            setEstimatedTime(message.estimatedTime || '');
            setAutomationRunning(true);
          } else if (message.type === 'automation_progress') {
            setAutomationProgress(message.progress);
            setAutomationMessage(message.currentAction);
          } else if (message.type === 'manual_intervention') {
            setManualInspectUrl(message.inspectUrl);
            setManualInstructions(message.instructions);
            setShowManualModal(true);
          } else if (message.type === 'open_login_tab') {
            // Open new tab with login interface
            const loginTabUrl = `${window.location.origin}/dashboard/test-browser/login?liveViewUrl=${encodeURIComponent(message.liveViewUrl)}`;
            window.open(loginTabUrl, '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
            setShowManualModal(false);
          } else if (message.type === 'automation_complete') {
            setAutomationRunning(false);
            setAutomationComplete(true);
            setAutomationProgress(100);
            setAutomationMessage(message.summary);
            setTimeout(() => {
              setAutomationComplete(false);
              resetAutomationState();
            }, 10000);
          } else if (message.type === 'start_live_stream') {
            // Automatically start live streaming when automation begins
            setIsStreaming(true);
            console.log('Live streaming activated for automation');
          } else if (message.type === 'automation_error') {
            setAutomationRunning(false);
            setAutomationError(message.error);
            setTimeout(() => {
              setAutomationError('');
              resetAutomationState();
            }, 5000);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };
      
      websocket.onclose = () => {
        console.log('Browser WebSocket disconnected');
        setWsConnected(false);
        setWs(null);
        
        // Reconnect after 3 seconds
        setTimeout(setupWebSocket, 3000);
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('WebSocket setup error:', error);
    }
  };

  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`/api/test-browser${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return response.json();
  };

  const checkStatus = async () => {
    try {
      const result = await apiRequest('/status');
      setStatus(result);
      setIsStreaming(result.isStreaming || false);
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    
    try {
      const result = await apiRequest('/test-connection', { method: 'POST' });
      
      if (result.success) {
        await checkStatus();
      }
    } catch (error: any) {
      console.error('Connection failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigate = async () => {
    if (!navigateUrl.trim() || !status.isConnected) return;
    
    setLoading(true);
    try {
      const result = await apiRequest('/navigate', {
        method: 'POST',
        body: JSON.stringify({ url: navigateUrl })
      });
      
      if (result.success) {
        await checkStatus();
      }
    } catch (error: any) {
      console.error('Navigation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStreaming = async () => {
    setLoading(true);
    
    try {
      const endpoint = isStreaming ? '/stop-streaming' : '/start-streaming';
      const result = await apiRequest(endpoint, { method: 'POST' });
      
      if (result.success) {
        setIsStreaming(!isStreaming);
        if (!isStreaming) {
          setLiveFrame(null); // Clear old frame when starting
        }
      }
    } catch (error: any) {
      console.error('Streaming toggle failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendBrowserControl = (action: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'browser_control',
        action
      }));
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!manualControlEnabled || !status.isConnected || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate proper coordinate mapping for 1400x900 browser viewport
    const scaleX = 1400 / rect.width;
    const scaleY = 900 / rect.height;
    
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);
    
    sendBrowserControl({
      type: 'click',
      x,
      y
    });
    
    console.log(`Click sent: ${x}, ${y}`);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (!manualControlEnabled || !status.isConnected) return;
    
    if (event.key.length === 1) {
      sendBrowserControl({
        type: 'type',
        text: event.key
      });
    }
  };

  const handleScroll = (event: React.WheelEvent) => {
    if (!manualControlEnabled || !status.isConnected) return;
    
    event.preventDefault();
    sendBrowserControl({
      type: 'scroll',
      deltaY: event.deltaY
    });
  };

  const closeSession = async () => {
    setLoading(true);
    
    try {
      await apiRequest('/session', { method: 'DELETE' });
      setLiveFrame(null);
      setIsStreaming(false);
      setManualControlEnabled(false);
      resetAutomationState();
      await checkStatus();
    } catch (error: any) {
      console.error('Session close failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Additional Automation Functions

  const startTestAutomation = async () => {
    if (!status.isConnected) {
      alert('Please connect to browser first');
      return;
    }

    if (!twitterUsername.trim() || !twitterPassword.trim()) {
      alert('Please enter your Twitter username and password before starting automation');
      return;
    }

    setLoading(true);
    resetAutomationState();
    setAutomationRunning(true);
    
    try {
      const result = await apiRequest('/test-automation', { 
        method: 'POST',
        body: JSON.stringify({ 
          username: twitterUsername, 
          password: twitterPassword 
        })
      });
      
      if (!result.success) {
        setAutomationError(result.message || 'Automation failed');
        setAutomationRunning(false);
      }
    } catch (error: any) {
      console.error('Automation failed:', error);
      setAutomationError('Failed to start automation');
      setAutomationRunning(false);
    } finally {
      setLoading(false);
    }
  };

  const stopAutomation = async () => {
    // Stop automation by closing session
    await closeSession();
    resetAutomationState();
  };

  const openManualDevTools = () => {
    if (manualInspectUrl) {
      window.open(manualInspectUrl, '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
    }
  };

  const checkLoginStatus = async () => {
    try {
      const response = await apiRequest('/check-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      console.log('Login check response:', response);
      
      if (response.loginDetected) {
        setShowManualModal(false);
        alert('Login detected successfully! Automation will continue.');
        console.log('Login detected successfully!', response.indicators);
      } else {
        console.log('Login not detected yet:', response.indicators);
        alert(`Login not detected yet. Current URL: ${response.currentUrl}`);
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      alert('Error checking login status. Check console for details.');
    }
  };

  // Update canvas when live frame changes
  useEffect(() => {
    if (canvasRef.current && liveFrame) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Draw click indicator if present
          if (clickIndicator) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / 1400;
            const scaleY = rect.height / 900;
            const indicatorX = clickIndicator.x * scaleX;
            const indicatorY = clickIndicator.y * scaleY;
            
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, 10, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }
      };
      
      img.src = liveFrame;
    }
  }, [liveFrame, clickIndicator]);

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(0,0%,20%)] bg-[hsl(0,0%,6%)]">
        <div className="flex items-center space-x-4 px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/dashboard")}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-2xl font-bold">Live Browser Control</h1>
            <p className="text-gray-400 text-sm">Professional browser automation testing</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Status Bar */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Badge variant={status.isConnected ? "default" : "secondary"} className="flex items-center space-x-2">
                    {status.isConnected ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span>{status.isConnected ? "Connected" : "Disconnected"}</span>
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant={isStreaming ? "default" : "secondary"} className="flex items-center space-x-2">
                    <Monitor className="h-4 w-4" />
                    <span>Stream {isStreaming ? "Active" : "Inactive"}</span>
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant={wsConnected ? "default" : "secondary"} className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4" />
                    <span>WebSocket {wsConnected ? "Connected" : "Disconnected"}</span>
                  </Badge>
                </div>
                
                {manualControlEnabled && (
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                    <Mouse className="h-4 w-4 mr-1" />
                    Manual Control ON
                  </Badge>
                )}
              </div>
              
              {status.currentUrl && (
                <div className="text-sm">
                  <span className="text-gray-400">Current URL:</span>
                  <span className="ml-2 font-mono text-blue-400">{status.currentUrl}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection Controls */}
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle>Browser Connection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testConnection} 
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {status.isConnected ? "Reconnect" : "Connect to Browser"}
              </Button>
              
              <Button 
                onClick={closeSession} 
                disabled={loading || !status.isConnected}
                variant="destructive"
                className="w-full"
              >
                <Square className="h-4 w-4 mr-2" />
                Close Session
              </Button>
            </CardContent>
          </Card>

          {/* Navigation Controls */}
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle>Navigation & Streaming</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Navigate to URL</Label>
                <Input
                  id="url"
                  value={navigateUrl}
                  onChange={(e) => setNavigateUrl(e.target.value)}
                  placeholder="https://twitter.com"
                  className="bg-[hsl(0,0%,12%)] border-[hsl(0,0%,25%)]"
                />
              </div>
              
              <Button 
                onClick={navigate} 
                disabled={loading || !status.isConnected || !navigateUrl.trim()}
                className="w-full"
              >
                <Globe className="h-4 w-4 mr-2" />
                Navigate
              </Button>
              
              <Button 
                onClick={toggleStreaming} 
                disabled={loading || !status.isConnected}
                variant={isStreaming ? "destructive" : "default"}
                className="w-full"
                size="lg"
              >
                {isStreaming ? (
                  <Square className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isStreaming ? "Stop Live Stream" : "Start Live Stream"}
              </Button>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="manualControl"
                  checked={manualControlEnabled}
                  onChange={(e) => setManualControlEnabled(e.target.checked)}
                  disabled={!status.isConnected || !isStreaming}
                  className="rounded"
                />
                <Label htmlFor="manualControl" className="text-sm">
                  Enable Manual Control
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Automation Section */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5" />
              <span>X/Twitter Test Automation</span>
              {automationRunning && (
                <Badge variant="outline" className="text-green-400 border-green-400">
                  Running
                </Badge>
              )}
              {automationComplete && (
                <Badge variant="outline" className="text-blue-400 border-blue-400">
                  Complete
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Comprehensive automated testing: login, browse, interact with posts, like, and reply
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Twitter Credentials Form */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-[hsl(0,0%,12%)] border border-[hsl(0,0%,25%)] rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="twitter-username" className="text-sm font-medium text-gray-300">
                  X/Twitter Username
                </Label>
                <Input
                  id="twitter-username"
                  type="text"
                  placeholder="Enter username or email"
                  value={twitterUsername}
                  onChange={(e) => setTwitterUsername(e.target.value)}
                  className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,30%)] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter-password" className="text-sm font-medium text-gray-300">
                  Password
                </Label>
                <Input
                  id="twitter-password"
                  type="password"
                  placeholder="Enter password"
                  value={twitterPassword}
                  onChange={(e) => setTwitterPassword(e.target.value)}
                  className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,30%)] text-white"
                />
              </div>
            </div>

            {/* Main Automation Button */}
            <div className="text-center">
              <Button 
                onClick={startTestAutomation}
                disabled={loading || automationRunning || !status.isConnected}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold"
                size="lg"
              >
                {automationRunning ? (
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Play className="h-5 w-5 mr-2" />
                )}
                {automationRunning ? "Automation Running..." : "Start Test Automation"}
              </Button>
              
              {automationRunning && (
                <Button 
                  onClick={stopAutomation}
                  variant="destructive"
                  className="ml-4 px-6 py-4"
                  size="lg"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>

            {/* Progress Display */}
            {(automationRunning || automationComplete || automationError) && (
              <div className="bg-[hsl(0,0%,12%)] border border-[hsl(0,0%,25%)] rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Automation Progress</h3>
                  <span className="text-sm text-gray-400">
                    Step {automationStep} of {automationTotalSteps}
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${automationProgress}%` }}
                  ></div>
                </div>
                
                {/* Status Message */}
                <p className="text-center text-gray-300 mb-2">{automationMessage}</p>
                
                {estimatedTime && (
                  <p className="text-center text-sm text-gray-400">
                    Estimated time: {estimatedTime}
                  </p>
                )}
                
                {/* Error Display */}
                {automationError && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-5 w-5 text-red-400" />
                      <span className="text-red-400 font-medium">Automation Error</span>
                    </div>
                    <p className="text-red-300 mt-2">{automationError}</p>
                  </div>
                )}
                
                {/* Success Display */}
                {automationComplete && (
                  <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      <span className="text-green-400 font-medium">Automation Complete</span>
                    </div>
                    <p className="text-green-300 mt-2">Successfully completed all automation steps!</p>
                  </div>
                )}
              </div>
            )}

            {/* Automation Steps Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-4 rounded-lg border ${automationStep >= 1 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-gray-500/10 border-gray-500/30'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${automationStep >= 1 ? 'bg-blue-400' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">Navigation</span>
                </div>
                <p className="text-xs text-gray-400">Navigate to X login</p>
              </div>
              
              <div className={`p-4 rounded-lg border ${automationStep >= 3 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-gray-500/10 border-gray-500/30'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${automationStep >= 3 ? 'bg-yellow-400' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">Login</span>
                </div>
                <p className="text-xs text-gray-400">Manual login handoff</p>
              </div>
              
              <div className={`p-4 rounded-lg border ${automationStep >= 5 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-gray-500/10 border-gray-500/30'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${automationStep >= 5 ? 'bg-purple-400' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">Posts</span>
                </div>
                <p className="text-xs text-gray-400">Find and select posts</p>
              </div>
              
              <div className={`p-4 rounded-lg border ${automationStep >= 7 ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-gray-500/30'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${automationStep >= 7 ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium">Interact</span>
                </div>
                <p className="text-xs text-gray-400">Like and reply to posts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Login Notification */}
        {showManualModal && (
          <div className="fixed top-20 right-6 bg-[hsl(0,0%,8%)] border border-yellow-500/30 rounded-lg p-4 max-w-sm z-50 shadow-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <Monitor className="h-5 w-5 text-yellow-400 mt-1" />
              </div>
              <div className="flex-1">
                <h4 className="text-yellow-300 font-medium mb-1">Manual Login Required</h4>
                <p className="text-yellow-200 text-sm mb-3">
                  Please log in using the live browser below. The automation will continue automatically once you're logged in.
                </p>
                <Button 
                  onClick={() => {
                    checkLoginStatus();
                    setShowManualModal(false);
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Continue Automation
                </Button>
              </div>
              <button 
                onClick={() => setShowManualModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Live Browser View */}
        {isStreaming && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>Live Browser View</span>
                <Badge variant="default" className="ml-2 bg-green-500">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2"></div>
                  Live
                </Badge>
              </CardTitle>
              <CardDescription>
                {manualControlEnabled 
                  ? "Click anywhere to interact with the browser. Type to send keystrokes. Scroll with mouse wheel."
                  : "Real-time browser view. Enable manual control to interact."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-green-400 border-green-400">20+ FPS</Badge>
                  <Badge variant="outline" className="text-blue-400 border-blue-400">1400×900</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualControlEnabled(!manualControlEnabled)}
                  className={manualControlEnabled ? "bg-green-500/20 border-green-500 text-green-400" : ""}
                >
                  {manualControlEnabled ? "Manual Control ON" : "Enable Manual Control"}
                </Button>
              </div>
              
              <div 
                className={`border border-[hsl(0,0%,25%)] rounded-lg overflow-hidden ${
                  manualControlEnabled ? 'cursor-crosshair' : 'cursor-default'
                }`}
                tabIndex={manualControlEnabled ? 0 : -1}
                onKeyDown={manualControlEnabled ? handleKeyPress : undefined}
                onWheel={manualControlEnabled ? handleScroll : undefined}
              >
                {liveFrame ? (
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      width={1400}
                      height={900}
                      onClick={manualControlEnabled ? handleCanvasClick : undefined}
                      className="w-full h-auto bg-black"
                      style={{ maxHeight: '80vh' }}
                    />
                    {clickIndicator && (
                      <div 
                        className="absolute w-4 h-4 border-2 border-red-500 rounded-full pointer-events-none animate-ping"
                        style={{
                          left: `${clickIndicator.x}px`,
                          top: `${clickIndicator.y}px`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-full bg-black rounded-lg flex items-center justify-center" style={{ minHeight: '600px' }}>
                    <div className="text-center">
                      <RefreshCw className="h-12 w-12 mx-auto mb-4 text-gray-400 animate-spin" />
                      <p className="text-gray-400 text-lg">Loading live browser view...</p>
                    </div>
                  </div>
                )}
              </div>
              
              {manualControlEnabled && liveFrame && (
                <div className="mt-4 text-center text-sm text-gray-400">
                  <p>Manual control enabled. Click on the browser to interact directly with the page.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Start Streaming Section */}
        {!isStreaming && status.isConnected && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardContent className="p-8 text-center">
              <Monitor className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No Live Stream</h3>
              <p className="text-gray-400 mb-4">Start live streaming to see the browser view</p>
              <Button onClick={toggleStreaming} disabled={loading}>
                <Play className="h-4 w-4 mr-2" />
                Start Live Stream
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}