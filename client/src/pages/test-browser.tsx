import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  RefreshCw,
  Pause,
  BarChart3,
  Target,
  Heart,
  MessageCircle,
  UserPlus,
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
  replies: number;
  likes: number;
  follows: number;
  targetReplies: number;
  targetLikes: number;
  targetFollows: number;
  energyLevel: number;
  focusLevel: number;
  currentPhase: string;
  isPaused: boolean;
}

export default function TestBrowser() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<BrowserbaseStatus>({
    isConnected: false,
    status: "disconnected",
  });
  const [loading, setLoading] = useState(false);
  const [navigateUrl, setNavigateUrl] = useState("https://x.com");
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<string>("");

  // Enhanced automation state
  const [automation, setAutomation] = useState<AutomationState>({
    running: false,
    status: "",
    progress: 0,
    step: 0,
    totalSteps: 8,
    message: "",
    replies: 0,
    likes: 0,
    follows: 0,
    targetReplies: 100,
    targetLikes: 100,
    targetFollows: 100,
    energyLevel: 100,
    focusLevel: 100,
    currentPhase: "idle",
    isPaused: false,
  });

  // Test Script state
  const [isTestScriptRunning, setIsTestScriptRunning] = useState(false);
  const [automationStatus, setAutomationStatus] = useState<string>("");
  const [showManualIntervention, setShowManualIntervention] = useState(false);
  const [testScriptLiveViewUrl, setTestScriptLiveViewUrl] =
    useState<string>("");

  // Secondary tab live view state
  const [secondaryTabUrl, setSecondaryTabUrl] = useState<string | null>(null);
  const [secondaryTabName, setSecondaryTabName] = useState<string>("");
  const [showSecondaryTab, setShowSecondaryTab] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sessionStartTime = useRef<number>(0);

  // API request helper
  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const url = `/api/test-browser${endpoint}`;
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Request failed" }));
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
          case "live_view_url":
            setLiveViewUrl(data.url);
            setTestScriptLiveViewUrl(data.url);
            break;
          case "automation_status":
          case "automation_progress":
            setAutomation((prev) => ({
              ...prev,
              running: true,
              status: data.status || prev.status,
              progress: data.automationState
                ? ((data.automationState.replies +
                    data.automationState.likes +
                    data.automationState.follows) /
                    (data.automationState.targetReplies +
                      data.automationState.targetLikes +
                      data.automationState.targetFollows)) *
                  100
                : prev.progress,
              step: data.step || prev.step,
              message: data.message || prev.message,
              ...data.automationState,
            }));
            setAutomationStatus(data.message || "");
            if (data.liveViewUrl && !liveViewUrl) {
              setLiveViewUrl(data.liveViewUrl);
              setTestScriptLiveViewUrl(data.liveViewUrl);
            }
            break;
          case "automation_complete":
            setAutomation((prev) => ({
              ...prev,
              running: false,
              status: "completed",
              progress: 100,
              message: data.message || "Automation completed successfully",
              ...data.automationState,
            }));
            setIsTestScriptRunning(false);
            setShowManualIntervention(false);
            setAutomationStatus("");
            console.log("🎉 Enhanced automation completed successfully!");
            break;
          case "automation_error":
            setAutomation((prev) => ({
              ...prev,
              running: false,
              status: "error",
              message: data.error || "Automation failed",
              ...data.automationState,
            }));
            setIsTestScriptRunning(false);
            setShowManualIntervention(false);
            setAutomationStatus("");
            console.error("Automation failed:", data.error);
            break;
          case "automation_paused":
            setAutomation((prev) => ({
              ...prev,
              isPaused: true,
              message: data.message || "Automation paused",
              ...data.automationState,
            }));
            setAutomationStatus(data.message || "Automation paused");
            break;
          case "automation_resumed":
            setAutomation((prev) => ({
              ...prev,
              isPaused: false,
              message: data.message || "Automation resumed",
              ...data.automationState,
            }));
            setAutomationStatus(data.message || "Automation resumed");
            break;
          case "session_closed":
            setLiveViewUrl(null);
            setTestScriptLiveViewUrl("");
            setStatus((prev) => ({
              ...prev,
              isConnected: false,
              status: "disconnected",
            }));
            break;
          case "login_detected":
            setShowManualIntervention(false);
            setAutomationStatus(
              "Login detected! Starting enhanced automation...",
            );
            if (data.liveViewUrl && !liveViewUrl) {
              setLiveViewUrl(data.liveViewUrl);
              setTestScriptLiveViewUrl(data.liveViewUrl);
            }
            break;
          case "secondary_tab_opened":
            console.log(`🎥 ${data.tabType} tab opened:`, data.tabUrl);
            setSecondaryTabUrl(data.tabUrl);
            setSecondaryTabName(data.tabName || "Secondary Tab");
            setShowSecondaryTab(true);
            setAutomation((prev) => ({
              ...prev,
              message:
                data.message || `${data.tabType} tab opened in secondary view`,
            }));
            break;
          case "secondary_tab_closing":
            console.log(`🔄 ${data.tabType} tab closing, returning to X`);
            setAutomation((prev) => ({
              ...prev,
              message: data.message || `${data.tabType} tab closing...`,
            }));
            break;
          case "secondary_tab_closed":
            console.log(`✅ ${data.tabType} tab closed`);
            setShowSecondaryTab(false);
            setSecondaryTabUrl(null);
            setSecondaryTabName("");
            setAutomation((prev) => ({
              ...prev,
              message: data.message || `${data.tabType} tab closed`,
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
        const remaining = Math.max(0, 21600000 - elapsed); // 6 hours in ms

        if (remaining === 0) {
          setSessionTimeRemaining("Session expired");
          return;
        }

        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setSessionTimeRemaining(
          `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
        );
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
      const response = await apiRequest("/status");
      setStatus(response);
      if (response.automationState) {
        setAutomation((prev) => ({ ...prev, ...response.automationState }));
      }
    } catch (error) {
      console.error("Status check failed:", error);
    }
  };

  const connectAndStartLiveView = async () => {
    setLoading(true);
    try {
      console.log("Connecting to Browserbase with Pro plan features...");
      const response = await apiRequest("/test-connection", { method: "POST" });

      console.log("Connection response:", response);
      setStatus(response);
      sessionStartTime.current = Date.now();

      if (response.liveViewUrl) {
        setLiveViewUrl(response.liveViewUrl);
        setTestScriptLiveViewUrl(response.liveViewUrl);
      } else {
        setTimeout(async () => {
          try {
            const streamResponse = await apiRequest("/start-streaming", {
              method: "POST",
            });
            if (streamResponse.liveViewUrl) {
              setLiveViewUrl(streamResponse.liveViewUrl);
              setTestScriptLiveViewUrl(streamResponse.liveViewUrl);
            }
          } catch (e) {
            console.error("Failed to start live view:", e);
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error("Connection failed:", error);
      alert(`Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = async () => {
    if (!status.isConnected) {
      alert("Please connect first");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/navigate", {
        method: "POST",
        body: JSON.stringify({ url: navigateUrl }),
      });
    } catch (error: any) {
      alert(`Navigation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async () => {
    setLoading(true);
    try {
      await apiRequest("/session", { method: "DELETE" });
      setLiveViewUrl(null);
      setTestScriptLiveViewUrl("");
      setStatus({ isConnected: false, status: "disconnected" });
      setSessionTimeRemaining("");
      sessionStartTime.current = 0;
      setAutomation({
        running: false,
        status: "",
        progress: 0,
        step: 0,
        totalSteps: 8,
        message: "",
        replies: 0,
        likes: 0,
        follows: 0,
        targetReplies: 100,
        targetLikes: 100,
        targetFollows: 100,
        energyLevel: 100,
        focusLevel: 100,
        currentPhase: "idle",
        isPaused: false,
      });
      setShowSecondaryTab(false);
      setSecondaryTabUrl(null);
      setSecondaryTabName("");
    } catch (error: any) {
      console.error("Session termination failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestScript = async () => {
    try {
      setIsTestScriptRunning(true);
      setAutomationStatus("Starting enhanced automation...");

      const response = await apiRequest("/test-script", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (response.success) {
        if (response.status === "manual_login_required") {
          setShowManualIntervention(true);
          setTestScriptLiveViewUrl(response.liveViewUrl);
          setAutomationStatus(response.message);
        } else if (response.status === "continuing_automation") {
          setAutomationStatus(response.message);
        }
      } else {
        console.error(`Test script failed: ${response.message}`);
        setIsTestScriptRunning(false);
      }
    } catch (error: any) {
      console.error("Failed to start test script:", error);
      setIsTestScriptRunning(false);
    }
  };

  const pauseAutomation = async () => {
    try {
      await apiRequest("/pause-automation", { method: "POST" });
    } catch (error: any) {
      console.error("Failed to pause automation:", error);
    }
  };

  const resumeAutomation = async () => {
    try {
      await apiRequest("/resume-automation", { method: "POST" });
    } catch (error: any) {
      console.error("Failed to resume automation:", error);
    }
  };

  const reconnectSession = async () => {
    if (!status.sessionId) {
      alert("No session ID available for reconnection");
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest("/reconnect-session", {
        method: "POST",
        body: JSON.stringify({ sessionId: status.sessionId }),
      });

      if (response.success) {
        setStatus((prev) => ({
          ...prev,
          isConnected: true,
          sessionId: response.sessionId,
        }));
        setLiveViewUrl(response.liveViewUrl);
        setTestScriptLiveViewUrl(response.liveViewUrl);
        sessionStartTime.current = Date.now();

        if (response.cookiesValid) {
          alert("Reconnected successfully with saved login!");
        } else {
          alert("Reconnected, but manual login required (cookies expired)");
        }
      } else {
        alert(`Reconnection failed: ${response.message}`);
      }
    } catch (error: any) {
      alert(`Reconnection failed: ${error.message}`);
    } finally {
      setLoading(false);
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
              onClick={() => setLocation("/dashboard")}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-white">
              Enhanced X Automation
            </h1>
          </div>

          {status.isConnected && sessionTimeRemaining && (
            <Badge
              variant="outline"
              className="text-green-400 border-green-400"
            >
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
                  Pro Plan: Stealth + 6h Sessions + Proxies
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
                      <span className="text-gray-300">Features:</span>
                      <div className="flex gap-1">
                        <Badge
                          variant="outline"
                          className="text-green-400 border-green-400 text-xs"
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          Stealth
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-blue-400 border-blue-400 text-xs"
                        >
                          6h
                        </Badge>
                      </div>
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
                        <div
                          className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400" : "bg-red-400"}`}
                        />
                        <span
                          className={`text-xs ${wsConnected ? "text-green-400" : "text-red-400"}`}
                        >
                          {wsConnected ? "Connected" : "Disconnected"}
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

                  {status.sessionId && !status.isConnected && (
                    <Button
                      onClick={reconnectSession}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reconnect with Cookies
                    </Button>
                  )}

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
                  <Label htmlFor="url" className="text-gray-300">
                    URL
                  </Label>
                  <Input
                    id="url"
                    value={navigateUrl}
                    onChange={(e) => setNavigateUrl(e.target.value)}
                    placeholder="https://x.com"
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

            {/* Enhanced Test Script */}
            <Card className="bg-black/50 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">
                  Enhanced X Automation
                </CardTitle>
                <CardDescription className="text-gray-300">
                  6-hour human-like automation: 100 replies, 100 likes, 100
                  follows
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Automation Progress */}
                {automation.running && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-blue-400">
                          <MessageCircle className="w-3 h-3" />
                          <span>
                            {automation.replies}/{automation.targetReplies}
                          </span>
                        </div>
                        <div className="text-gray-400">Replies</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-red-400">
                          <Heart className="w-3 h-3" />
                          <span>
                            {automation.likes}/{automation.targetLikes}
                          </span>
                        </div>
                        <div className="text-gray-400">Likes</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-green-400">
                          <UserPlus className="w-3 h-3" />
                          <span>
                            {automation.follows}/{automation.targetFollows}
                          </span>
                        </div>
                        <div className="text-gray-400">Follows</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Overall Progress</span>
                        <span className="text-purple-400">
                          {Math.round(automation.progress)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${automation.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Human Behavior Indicators */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Energy</span>
                          <span className="text-yellow-400">
                            {Math.round(automation.energyLevel)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1">
                          <div
                            className="bg-yellow-400 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${automation.energyLevel}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Focus</span>
                          <span className="text-cyan-400">
                            {Math.round(automation.focusLevel)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1">
                          <div
                            className="bg-cyan-400 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${automation.focusLevel}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-300 bg-gray-800/50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${automation.isPaused ? "bg-yellow-400" : "bg-green-400"}`}
                        />
                        <span>{automation.message}</span>
                      </div>
                    </div>
                  </div>
                )}

                {isTestScriptRunning &&
                  automationStatus &&
                  !automation.running && (
                    <div className="p-3 bg-blue-900/50 rounded-lg border border-blue-500/30">
                      <p className="text-blue-300 text-sm">
                        {automationStatus}
                      </p>
                    </div>
                  )}

                {/* Control Buttons */}
                <div className="space-y-2">
                  <Button
                    onClick={handleTestScript}
                    disabled={isTestScriptRunning || automation.running}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isTestScriptRunning || automation.running ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Running Enhanced Automation...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Enhanced Automation
                      </>
                    )}
                  </Button>

                  {automation.running && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={pauseAutomation}
                        disabled={automation.isPaused}
                        variant="outline"
                        className="text-yellow-400 border-yellow-400 hover:bg-yellow-400/10"
                      >
                        <Pause className="w-4 h-4 mr-2" />
                        {automation.isPaused ? "Paused" : "Pause"}
                      </Button>
                      <Button
                        onClick={resumeAutomation}
                        disabled={!automation.isPaused}
                        variant="outline"
                        className="text-green-400 border-green-400 hover:bg-green-400/10"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Resume
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Automation Stats */}
            {(automation.running || automation.status === "completed") && (
              <Card className="bg-black/50 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Session Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Phase</div>
                      <div className="text-white capitalize">
                        {automation.currentPhase}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Status</div>
                      <div
                        className={`capitalize ${automation.isPaused ? "text-yellow-400" : "text-green-400"}`}
                      >
                        {automation.isPaused ? "Paused" : automation.status}
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-gray-700" />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Actions</span>
                      <span className="text-white">
                        {automation.replies +
                          automation.likes +
                          automation.follows}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Completion Rate</span>
                      <span className="text-white">
                        {Math.round(automation.progress)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Live View */}
          <div className="lg:col-span-2">
            <Card className="bg-black/50 border-purple-500/20 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Live Browser View
                  {(liveViewUrl || testScriptLiveViewUrl) && (
                    <Badge
                      variant="outline"
                      className="text-green-400 border-green-400"
                    >
                      LIVE
                    </Badge>
                  )}
                  {showSecondaryTab && (
                    <Badge
                      variant="outline"
                      className="text-blue-400 border-blue-400"
                    >
                      DUAL VIEW
                    </Badge>
                  )}
                  {automation.running && (
                    <Badge
                      variant="outline"
                      className="text-purple-400 border-purple-400"
                    >
                      AUTOMATING
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent
                className={
                  showSecondaryTab ? "h-[800px] space-y-4" : "h-[800px]"
                }
              >
                {showManualIntervention && testScriptLiveViewUrl ? (
                  <div className="h-full">
                    <div className="mb-4 p-4 bg-yellow-900/50 rounded-lg border border-yellow-500/30">
                      <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                        Manual Login Required
                      </h3>
                      <p className="text-yellow-200">{automationStatus}</p>
                      <p className="text-sm text-yellow-200 mt-2">
                        Please complete login manually above. Enhanced
                        automation will start automatically once you're logged
                        in and on the X home page.
                      </p>
                    </div>
                    <iframe
                      src={testScriptLiveViewUrl}
                      className="w-full h-[680px] border-0 rounded-lg bg-white"
                      title="Manual Login Required"
                      allow="camera; microphone; display-capture; clipboard-read; clipboard-write"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  </div>
                ) : liveViewUrl || testScriptLiveViewUrl ? (
                  showSecondaryTab ? (
                    <div className="h-full space-y-4">
                      {/* Main X Tab */}
                      <div className="h-[48%]">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className="text-purple-400 border-purple-400"
                          >
                            X Tab
                          </Badge>
                          <span className="text-sm text-gray-400">
                            Main automation view
                          </span>
                          {automation.running && (
                            <Badge
                              variant="outline"
                              className="text-green-400 border-green-400 text-xs"
                            >
                              ACTIVE
                            </Badge>
                          )}
                        </div>
                        <iframe
                          ref={iframeRef}
                          src={liveViewUrl || testScriptLiveViewUrl}
                          className="w-full h-full border-0 rounded-lg bg-white"
                          title="Browserbase Live View - X Tab"
                          allow="camera; microphone; display-capture"
                        />
                      </div>

                      {/* Secondary Tab */}
                      <div className="h-[48%]">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className="text-blue-400 border-blue-400"
                          >
                            {secondaryTabName}
                          </Badge>
                          <span className="text-sm text-gray-400">
                            Secondary tab live view
                          </span>
                        </div>
                        <iframe
                          src={secondaryTabUrl || ""}
                          className="w-full h-full border-0 rounded-lg bg-white"
                          title={`Browserbase Live View - ${secondaryTabName}`}
                          allow="camera; microphone; display-capture"
                        />
                      </div>
                    </div>
                  ) : (
                    <iframe
                      ref={iframeRef}
                      src={liveViewUrl || testScriptLiveViewUrl}
                      className="w-full h-full border-0 rounded-lg bg-white"
                      title="Browserbase Live View"
                      allow="camera; microphone; display-capture"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-lg border-2 border-dashed border-gray-600">
                    <div className="text-center">
                      <Monitor className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-300 mb-2">
                        {status.isConnected
                          ? "Starting Live View..."
                          : "No Active Session"}
                      </h3>
                      <p className="text-gray-500">
                        {status.isConnected
                          ? "Live browser view will appear here shortly"
                          : "Connect to Browserbase to see live browser view"}
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
