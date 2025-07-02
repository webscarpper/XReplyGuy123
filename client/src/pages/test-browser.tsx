import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft,
  Play,
  Square,
  Shield,
  Globe,
  Timer,
  Monitor,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";

interface BrowserbaseStatus {
  isConnected: boolean;
  sessionId?: string;
  liveViewUrl?: string;
  stealthEnabled?: boolean;
  timeout?: string;
  status: string;
}

interface AutomationState {
  running: boolean;
  status: string;
  progress: number;
  step: number;
  totalSteps: number;
  message: string;
}

export default function TestBrowser() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<BrowserbaseStatus>({ isConnected: false, status: 'disconnected' });
  const [loading, setLoading] = useState(false);
  const [navigateUrl, setNavigateUrl] = useState("https://twitter.com");
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<string>("");

  // Automation state
  const [automation, setAutomation] = useState<AutomationState>({
    running: false,
    status: '',
    progress: 0,
    step: 0,
    totalSteps: 8,
    message: ''
  });
  const [twitterUsername, setTwitterUsername] = useState("");
  const [twitterPassword, setTwitterPassword] = useState("");

  // Test Script state
  const [isTestScriptRunning, setIsTestScriptRunning] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<string>('');
  const [showManualIntervention, setShowManualIntervention] = useState(false);
  const [testScriptLiveViewUrl, setTestScriptLiveViewUrl] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sessionStartTime = useRef<number>(0);

  // API request helper
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const url = `/api/test-browser${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  };

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/browser`;

      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log("Browser WebSocket connected");
        setWsConnected(true);
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WebSocket message:", data);

        switch (data.type) {
          case 'live_view_url':
            setLiveViewUrl(data.url);
            break;
          case 'automation_status':
            setAutomation(prev => ({
              ...prev,
              running: true,
              status: data.status,
              progress: (data.step / data.totalSteps) * 100,
              step: data.step,
              totalSteps: data.totalSteps,
              message: data.message
            }));
            break;
          case 'automation_complete':
            setAutomation(prev => ({
              ...prev,
              running: false,
              status: 'completed',
              progress: 100,
              message: 'Automation completed successfully'
            }));
            setIsTestScriptRunning(false);
            setShowManualIntervention(false);
            setAutomationStatus('');
            console.log('🎉 Test automation completed successfully!');
            break;
          case 'automation_error':
            setAutomation(prev => ({
              ...prev,
              running: false,
              status: 'error',
              message: data.error || 'Automation failed'
            }));
            setIsTestScriptRunning(false);
            setShowManualIntervention(false);
            setAutomationStatus('');
            console.error('Automation failed:', data.error);
            break;
          case 'session_closed':
            setLiveViewUrl(null);
            setStatus(prev => ({ ...prev, isConnected: false, status: 'disconnected' }));
            break;
          case 'automation_progress':
            setAutomationStatus(data.message);
            // Maintain live view URL if provided
            if (data.liveViewUrl && !liveViewUrl) {
              setLiveViewUrl(data.liveViewUrl);
            }
            break;
          case 'login_detected':
            setShowManualIntervention(false);
            setAutomationStatus('Login detected! Continuing automation...');
            // Maintain live view URL if provided
            if (data.liveViewUrl && !liveViewUrl) {
              setLiveViewUrl(data.liveViewUrl);
            }
            break;
          case 'youtube_tab_opened':
            console.log('🎥 YouTube tab opened:', data.youtubeTabUrl);
            console.log('📺 All tabs:', data.allTabs);

            // Show YouTube URL in console for manual viewing
            console.log('YouTube Live View URL:', data.youtubeTabUrl);

            // Update status to show YouTube tab is available
            setAutomation(prev => ({
              ...prev,
              message: `${data.message} - Copy YouTube URL from console to view in new tab`
            }));
            break;

          case 'youtube_tab_closing':
            console.log('🔄 YouTube tab closing, returning to X');
            setAutomation(prev => ({
              ...prev,
              message: 'YouTube tab closing, returning to X...'
            }));
            break;
        }
      };

      websocket.onclose = () => {
        console.log("Browser WebSocket disconnected");
        setWsConnected(false);
        setTimeout(connectWebSocket, 3000);
      };

      setWs(websocket);
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Session timer
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (status.isConnected && sessionStartTime.current > 0) {
      timer = setInterval(() => {
        const elapsed = Date.now() - sessionStartTime.current;
        const remaining = Math.max(0, 3600000 - elapsed); // 1 hour in ms

        if (remaining === 0) {
          setSessionTimeRemaining("Session expired");
          return;
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setSessionTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status.isConnected]);

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await apiRequest('/status');
      setStatus(response);
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const connectAndStartLiveView = async () => {
    setLoading(true);
    try {
      console.log("Connecting to Browserbase with stealth...");
      const response = await apiRequest('/test-connection', { method: 'POST' });

      console.log("Connection response:", response);
      setStatus(response);
      sessionStartTime.current = Date.now();

      if (response.liveViewUrl) {
        setLiveViewUrl(response.liveViewUrl);
      } else {
        // Start live view if not immediately available
        setTimeout(async () => {
          try {
            const streamResponse = await apiRequest('/start-streaming', { method: 'POST' });
            if (streamResponse.liveViewUrl) {
              setLiveViewUrl(streamResponse.liveViewUrl);
            }
          } catch (e) {
            console.error('Failed to start live view:', e);
          }
        }, 2000);
      }

    } catch (error: any) {
      console.error('Connection failed:', error);
      alert(`Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = async () => {
    if (!status.isConnected) {
      alert('Please connect first');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/navigate', {
        method: 'POST',
        body: JSON.stringify({ url: navigateUrl })
      });
    } catch (error: any) {
      alert(`Navigation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startAutomation = async () => {
    if (!status.isConnected) {
      alert('Please connect first');
      return;
    }

    if (!twitterUsername.trim() || !twitterPassword.trim()) {
      alert('Please enter Twitter credentials');
      return;
    }

    setLoading(true);
    setAutomation(prev => ({ ...prev, running: true, status: 'starting', message: 'Starting automation...' }));

    try {
      await apiRequest('/test-automation', {
        method: 'POST',
        body: JSON.stringify({
          username: twitterUsername,
          password: twitterPassword
        })
      });
    } catch (error: any) {
      setAutomation(prev => ({
        ...prev,
        running: false,
        status: 'error',
        message: error.message
      }));
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async () => {
    setLoading(true);
    try {
      await apiRequest('/session', { method: 'DELETE' });
      setLiveViewUrl(null);
      setStatus({ isConnected: false, status: 'disconnected' });
      setSessionTimeRemaining("");
      sessionStartTime.current = 0;
      setAutomation({
        running: false,
        status: '',
        progress: 0,
        step: 0,
        totalSteps: 8,
        message: ''
      });
    } catch (error: any) {
      console.error('Session termination failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestScript = async () => {
    try {
      setIsTestScriptRunning(true);
      setAutomationStatus('Starting automation...');

      const response = await apiRequest('/test-script', {
        method: 'POST',
        body: JSON.stringify({})
      });

      if (response.success) {
        if (response.status === 'manual_intervention_required') {
          setShowManualIntervention(true);
          setTestScriptLiveViewUrl(response.liveViewUrl);
          setAutomationStatus(response.message);
        } else if (response.status === 'continuing_automation') {
          setAutomationStatus(response.message);
        }
      } else {
        console.error(`Test script failed: ${response.message}`);
        setIsTestScriptRunning(false);
      }
    } catch (error: any) {
      console.error('Failed to start test script:', error);
      setIsTestScriptRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/dashboard')}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-white">Browserbase Live Testing</h1>
          </div>

          {status.isConnected && sessionTimeRemaining && (
            <Badge variant="outline" className="text-green-400 border-green-400">
              <Timer className="w-4 h-4 mr-1" />
              {sessionTimeRemaining}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="space-y-6">
            {/* Connection Status */}
            <Card className="bg-black/50 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Browserbase Session
                </CardTitle>
                <CardDescription className="text-gray-300">
                  Basic stealth + Auto CAPTCHA solving + Proxies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Status:</span>
                  <div className="flex items-center gap-2">
                    {status.isConnected ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400">Disconnected</span>
                      </>
                    )}
                  </div>
                </div>

                {status.isConnected && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Stealth Mode:</span>
                      <Badge variant="outline" className="text-green-400 border-green-400">
                        <Shield className="w-3 h-3 mr-1" />
                        Basic + CAPTCHA
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Session ID:</span>
                      <span className="text-xs text-purple-400 font-mono">
                        {status.sessionId?.substring(0, 8)}...
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">WebSocket:</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className={`text-xs ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
                          {wsConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <div className="pt-2 space-y-3">
                  <Button
                    onClick={connectAndStartLiveView}
                    disabled={loading || status.isConnected}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : status.isConnected ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Session Active
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Connect & Start Live View
                      </>
                    )}
                  </Button>

                  {(status.isConnected || liveViewUrl) && (
                    <Button
                      onClick={terminateSession}
                      disabled={loading}
                      variant="destructive"
                      className="w-full"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Terminate Session
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <Card className="bg-black/50 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Navigation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="url" className="text-gray-300">URL</Label>
                  <Input
                    id="url"
                    value={navigateUrl}
                    onChange={(e) => setNavigateUrl(e.target.value)}
                    placeholder="https://twitter.com"
                    className="bg-black/50 border-gray-600 text-white"
                  />
                </div>
                <Button
                  onClick={navigateTo}
                  disabled={!status.isConnected || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Navigate
                </Button>
              </CardContent>
            </Card>

            {/* Test Script */}
            <Card className="bg-black/50 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Complete Test Script</CardTitle>
                <CardDescription className="text-gray-300">
                  End-to-end automation with manual login handoff
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isTestScriptRunning && automationStatus && (
                  <div className="p-3 bg-blue-900/50 rounded-lg border border-blue-500/30">
                    <p className="text-blue-300 text-sm">{automationStatus}</p>
                  </div>
                )}

                <Button
                  onClick={handleTestScript}
                  disabled={isTestScriptRunning}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isTestScriptRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Running Test Script...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Test Script
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Twitter Automation */}
            <Card className="bg-black/50 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Twitter Automation Test</CardTitle>
                <CardDescription className="text-gray-300">
                  Test complete automation workflow (requires credentials)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="username" className="text-gray-300">Twitter Username</Label>
                  <Input
                    id="username"
                    value={twitterUsername}
                    onChange={(e) => setTwitterUsername(e.target.value)}
                    placeholder="@your_username"
                    className="bg-black/50 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-gray-300">Twitter Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={twitterPassword}
                    onChange={(e) => setTwitterPassword(e.target.value)}
                    placeholder="Your password"
                    className="bg-black/50 border-gray-600 text-white"
                  />
                </div>

                {automation.running && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Step {automation.step}/{automation.totalSteps}</span>
                      <span className="text-purple-400">{Math.round(automation.progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${automation.progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-300">{automation.message}</p>
                  </div>
                )}

                <Button
                  onClick={startAutomation}
                  disabled={!status.isConnected || loading || automation.running}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {automation.running ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Running Automation...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Twitter Test
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Live View */}
          <div className="lg:col-span-2">
            <Card className="bg-black/50 border-purple-500/20 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Live Browser View
                  {liveViewUrl && (
                    <Badge variant="outline" className="text-green-400 border-green-400">
                      LIVE
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[800px]">
                {showManualIntervention && testScriptLiveViewUrl ? (
                  <div className="h-full">
                    <div className="mb-4 p-4 bg-yellow-900/50 rounded-lg border border-yellow-500/30">
                      <h3 className="text-lg font-semibold text-yellow-300 mb-2">Manual Action Required</h3>
                      <p className="text-yellow-200">{automationStatus}</p>
                      <p className="text-sm text-yellow-200 mt-2">
                        Complete the login above. Automation will continue automatically once login is detected.
                      </p>
                    </div>
                    <iframe
                      src={testScriptLiveViewUrl}
                      className="w-full h-[680px] border-0 rounded-lg bg-white"
                      title="Test Script Manual Intervention"
                      allow="camera; microphone; display-capture; clipboard-read; clipboard-write"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </div>
                ) : liveViewUrl ? (
                  <iframe
                    ref={iframeRef}
                    src={liveViewUrl}
                    className="w-full h-full border-0 rounded-lg bg-white"
                    title="Browserbase Live View"
                    allow="camera; microphone; display-capture"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg border-2 border-dashed border-gray-600">
                    <div className="text-center">
                      <Monitor className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-300 mb-2">
                        {status.isConnected ? 'Starting Live View...' : 'No Active Session'}
                      </h3>
                      <p className="text-gray-500">
                        {status.isConnected 
                          ? 'Live browser view will appear here shortly'
                          : 'Connect to Browserbase to see live browser view'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}