import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft,
  Globe,
  Camera,
  Play,
  Square,
  RefreshCw,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Monitor,
  Twitter
} from "lucide-react";

interface BrowserStatus {
  isConnected: boolean;
  currentUrl?: string;
  title?: string;
  browserEndpoint?: string;
  timestamp?: string;
}

interface TestResult {
  success: boolean;
  message: string;
  error?: string;
  screenshot?: string;
  elements?: any;
  currentUrl?: string;
  title?: string;
}

export default function TestBrowser() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<BrowserStatus>({ isConnected: false });
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [navigateUrl, setNavigateUrl] = useState("https://twitter.com");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [manualControlEnabled, setManualControlEnabled] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);

  const userToken = localStorage.getItem('xreplyguy_wallet');

  if (!userToken) {
    setLocation('/');
    return null;
  }

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
            // Update live frame
            setLiveFrame(`data:image/jpeg;base64,${message.data}`);
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

  // Auto-refresh screenshot every 5 seconds when enabled
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh && status.isConnected) {
      interval = setInterval(() => {
        takeScreenshot();
      }, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, status.isConnected]);

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
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      const result = await apiRequest('/test-connection', { method: 'POST' });
      setTestResult(result);
      
      if (result.success) {
        await checkStatus();
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'Connection test failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const navigate = async () => {
    if (!navigateUrl.trim()) return;
    
    setLoading(true);
    try {
      const result = await apiRequest('/navigate', {
        method: 'POST',
        body: JSON.stringify({ url: navigateUrl })
      });
      
      setTestResult(result);
      
      if (result.success) {
        await checkStatus();
        // Auto-take screenshot after navigation
        setTimeout(() => takeScreenshot(), 2000);
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'Navigation failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const takeScreenshot = async () => {
    try {
      const result = await apiRequest('/screenshot');
      
      if (result.success) {
        setScreenshot(result.screenshot);
        setStatus(prev => ({
          ...prev,
          currentUrl: result.currentUrl,
          title: result.title
        }));
      } else {
        setTestResult({
          success: false,
          message: 'Screenshot failed',
          error: result.error
        });
      }
    } catch (error: any) {
      console.error('Screenshot failed:', error);
    }
  };

  const testTwitter = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      const result = await apiRequest('/test-twitter', { method: 'POST' });
      setTestResult(result);
      
      if (result.success && result.screenshot) {
        setScreenshot(result.screenshot);
      }
      
      await checkStatus();
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'Twitter test failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const startStreaming = async () => {
    setLoading(true);
    
    try {
      const result = await apiRequest('/start-streaming', { method: 'POST' });
      setTestResult(result);
      
      if (result.success) {
        setIsStreaming(true);
        setLiveFrame(null); // Clear old frame
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'Start streaming failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const stopStreaming = async () => {
    setLoading(true);
    
    try {
      const result = await apiRequest('/stop-streaming', { method: 'POST' });
      setTestResult(result);
      
      if (result.success) {
        setIsStreaming(false);
        setLiveFrame(null);
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'Stop streaming failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!manualControlEnabled || !status.isConnected) return;
    
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((event.clientX - rect.left) * (1280 / rect.width));
    const y = Math.round((event.clientY - rect.top) * (720 / rect.height));
    
    try {
      await apiRequest('/control', {
        method: 'POST',
        body: JSON.stringify({
          type: 'click',
          x,
          y
        })
      });
      
      console.log(`Manual click at ${x}, ${y}`);
    } catch (error) {
      console.error('Manual click failed:', error);
    }
  };

  const handleKeyPress = async (event: React.KeyboardEvent) => {
    if (!manualControlEnabled || !status.isConnected) return;
    
    // Only handle visible characters, ignore special keys
    if (event.key.length === 1) {
      try {
        await apiRequest('/control', {
          method: 'POST',
          body: JSON.stringify({
            type: 'type',
            text: event.key
          })
        });
        
        console.log(`Manual type: ${event.key}`);
      } catch (error) {
        console.error('Manual type failed:', error);
      }
    }
  };

  const handleScroll = async (deltaY: number) => {
    if (!manualControlEnabled || !status.isConnected) return;
    
    try {
      await apiRequest('/control', {
        method: 'POST',
        body: JSON.stringify({
          type: 'scroll',
          deltaY
        })
      });
      
      console.log(`Manual scroll: ${deltaY}`);
    } catch (error) {
      console.error('Manual scroll failed:', error);
    }
  };

  const closeSession = async () => {
    setLoading(true);
    
    try {
      const result = await apiRequest('/session', { method: 'DELETE' });
      setTestResult(result);
      setScreenshot(null);
      setLiveFrame(null);
      setIsStreaming(false);
      setManualControlEnabled(false);
      setAutoRefresh(false);
      await checkStatus();
    } catch (error: any) {
      setTestResult({
        success: false,
        message: 'Session close failed',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-2xl font-bold">Bright Data Browser Test</h1>
            <p className="text-gray-400 text-sm">Test and verify browser automation technology</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Status Panel */}
        <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Monitor className="h-5 w-5" />
              <span>Connection Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Badge variant={status.isConnected ? "default" : "secondary"} className="flex items-center space-x-2">
                {status.isConnected ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>{status.isConnected ? "Connected" : "Disconnected"}</span>
              </Badge>
              
              {status.browserEndpoint && (
                <span className="text-xs text-gray-400">
                  Endpoint: {status.browserEndpoint}
                </span>
              )}
              
              <Badge variant={wsConnected ? "default" : "secondary"} className="flex items-center space-x-2">
                {wsConnected ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>WebSocket {wsConnected ? "Connected" : "Disconnected"}</span>
              </Badge>
              
              <Badge variant={isStreaming ? "default" : "secondary"} className="flex items-center space-x-2">
                <span>Live Stream {isStreaming ? "Active" : "Inactive"}</span>
              </Badge>
            </div>
            
            {status.currentUrl && (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-gray-400">Current URL:</span>
                  <span className="ml-2 font-mono text-blue-400">{status.currentUrl}</span>
                </div>
                {status.title && (
                  <div className="text-sm">
                    <span className="text-gray-400">Page Title:</span>
                    <span className="ml-2">{status.title}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection Tests */}
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Connection Tests</span>
              </CardTitle>
              <CardDescription>Test browser connection and basic functionality</CardDescription>
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
                Test Connection
              </Button>
              
              <Button 
                onClick={testTwitter} 
                disabled={loading || !status.isConnected}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Twitter className="h-4 w-4 mr-2" />
                Test Twitter Navigation
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
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Navigation Controls</span>
              </CardTitle>
              <CardDescription>Navigate to specific URLs and take screenshots</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">URL to Navigate</Label>
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
                onClick={isStreaming ? stopStreaming : startStreaming} 
                disabled={loading || !status.isConnected}
                variant={isStreaming ? "destructive" : "default"}
                className="w-full"
              >
                {isStreaming ? (
                  <Square className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isStreaming ? "Stop Live Stream" : "Start Live Stream"}
              </Button>
              
              <Button 
                onClick={takeScreenshot} 
                disabled={loading || !status.isConnected}
                variant="outline"
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                Take Screenshot
              </Button>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="manualControl"
                  checked={manualControlEnabled}
                  onChange={(e) => setManualControlEnabled(e.target.checked)}
                  disabled={!status.isConnected}
                  className="rounded"
                />
                <Label htmlFor="manualControl" className="text-sm">
                  Manual Control (Click & Type)
                </Label>
              </div>
              
              {manualControlEnabled && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-xs text-yellow-300">
                    Manual control enabled: Click on browser view to interact, type to send keys, scroll with mouse wheel
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        {testResult && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                )}
                <span>Test Results</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className={testResult.success ? "border-green-500/50" : "border-red-500/50"}>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">{testResult.message}</p>
                    {testResult.error && (
                      <p className="text-sm text-red-400 font-mono">{testResult.error}</p>
                    )}
                    {testResult.elements && (
                      <div className="text-sm space-y-1">
                        <p><strong>Twitter Elements Detected:</strong></p>
                        <ul className="list-disc list-inside space-y-1 text-gray-300">
                          <li>Login Button: {testResult.elements.loginButtonExists ? '✓' : '✗'}</li>
                          <li>Sign Up Button: {testResult.elements.signUpButtonExists ? '✓' : '✗'}</li>
                          <li>Twitter Logo: {testResult.elements.twitterLogoExists ? '✓' : '✗'}</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Live Browser View */}
        {(liveFrame || screenshot) && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>{isStreaming ? "Live Browser Stream" : "Browser Screenshot"}</span>
                {isStreaming && (
                  <Badge variant="default" className="ml-2 bg-green-500">
                    Live
                  </Badge>
                )}
                {manualControlEnabled && (
                  <Badge variant="outline" className="ml-2 text-yellow-400 border-yellow-400">
                    Manual Control ON
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isStreaming 
                  ? "Real-time browser view - click to interact when manual control is enabled"
                  : "Static browser screenshot"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`border border-[hsl(0,0%,25%)] rounded-lg overflow-hidden ${
                  manualControlEnabled ? 'cursor-crosshair' : 'cursor-default'
                }`}
                tabIndex={manualControlEnabled ? 0 : -1}
                onKeyDown={manualControlEnabled ? handleKeyPress : undefined}
                onWheel={manualControlEnabled ? (e) => handleScroll(e.deltaY) : undefined}
              >
                <canvas
                  width={1280}
                  height={720}
                  onClick={manualControlEnabled ? handleCanvasClick : undefined}
                  className="w-full h-auto max-h-[600px] object-contain bg-black"
                  ref={(canvas) => {
                    if (canvas && (liveFrame || screenshot)) {
                      const ctx = canvas.getContext('2d');
                      const img = new Image();
                      img.onload = () => {
                        ctx?.clearRect(0, 0, canvas.width, canvas.height);
                        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                      };
                      img.src = liveFrame || screenshot || '';
                    }
                  }}
                />
              </div>
              
              {manualControlEnabled && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="text-sm text-blue-300 space-y-1">
                    <p><strong>Manual Control Active:</strong></p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Click anywhere on the browser view to send clicks</li>
                      <li>Focus the view and type to send keystrokes</li>
                      <li>Scroll with mouse wheel over the browser view</li>
                      <li>All actions are sent in real-time to the remote browser</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}