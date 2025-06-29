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
  const [clickIndicator, setClickIndicator] = useState<{x: number, y: number, id: number} | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
            setLiveFrame(`data:image/jpeg;base64,${message.data}`);
          } else if (message.type === 'control_feedback') {
            // Show click indicator
            if (message.action === 'click') {
              const id = Date.now();
              setClickIndicator({ x: message.x, y: message.y, id });
              setTimeout(() => setClickIndicator(null), 1000);
            }
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
      await checkStatus();
    } catch (error: any) {
      console.error('Session close failed:', error);
    } finally {
      setLoading(false);
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

        {/* Live Browser View */}
        {liveFrame && (
          <Card className="bg-[hsl(0,0%,8%)] border-[hsl(0,0%,20%)]">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="h-5 w-5" />
                <span>Live Browser View</span>
                {isStreaming && (
                  <Badge variant="default" className="ml-2 bg-green-500">
                    Live
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {manualControlEnabled 
                  ? "Click anywhere to interact with the browser. Type to send keystrokes. Scroll with mouse wheel."
                  : "Real-time browser view. Enable manual control to interact."
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
                onWheel={manualControlEnabled ? handleScroll : undefined}
              >
                <canvas
                  ref={canvasRef}
                  width={1400}
                  height={900}
                  onClick={manualControlEnabled ? handleCanvasClick : undefined}
                  className="w-full h-auto bg-black"
                  style={{ maxHeight: '80vh' }}
                />
              </div>
              
              {manualControlEnabled && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-center space-x-4 text-sm text-blue-300">
                    <div className="flex items-center space-x-2">
                      <Mouse className="h-4 w-4" />
                      <span>Click to interact</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Keyboard className="h-4 w-4" />
                      <span>Type to send keys</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4" />
                      <span>Scroll with mouse wheel</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {!liveFrame && status.isConnected && (
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