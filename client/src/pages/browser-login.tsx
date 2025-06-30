import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, Keyboard } from 'lucide-react';

export default function BrowserLogin() {
  const [, setLocation] = useLocation();
  const [liveViewUrl, setLiveViewUrl] = useState<string>('');
  const [continuingAutomation, setContinuingAutomation] = useState(false);
  const [automationContinued, setAutomationContinued] = useState(false);
  const [error, setError] = useState<string>('');
  const [screenshot, setScreenshot] = useState<string>('');
  const [browserInfo, setBrowserInfo] = useState<{url: string, title: string}>({url: '', title: ''});
  const [clicking, setClicking] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeText, setTypeText] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showAutomatedLogin, setShowAutomatedLogin] = useState(false);
  const [automatedLoginLoading, setAutomatedLoginLoading] = useState(false);

  const handleType = async () => {
    if (!typeText.trim()) return;
    
    try {
      // First clear any existing content with Ctrl+A then type new text
      await fetch('/api/test-browser/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'key', key: 'Control+a' })
      });
      
      // Small delay then type the new text
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch('/api/test-browser/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'type',
          text: typeText
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setShowTypeModal(false);
        setTypeText('');
      } else {
        console.error('Type failed:', result.message);
      }
    } catch (err: any) {
      console.error('Type error:', err);
    }
  };

  const fetchScreenshot = async () => {
    try {
      const response = await fetch('/api/test-browser/screenshot');
      const result = await response.json();
      
      if (result.success && result.screenshot) {
        setScreenshot(result.screenshot);
        setBrowserInfo({
          url: result.currentUrl || '',
          title: result.title || ''
        });
        setError(''); // Clear any previous errors
      } else {
        console.log('Screenshot not available:', result.message);
      }
    } catch (err: any) {
      console.error('Failed to fetch screenshot:', err);
    }
  };

  useEffect(() => {
    // Initialize browser session for login
    initializeBrowserSession();
    
    // Start fetching screenshots to show live browser state
    const screenshotInterval = setInterval(fetchScreenshot, 3000);
    
    return () => clearInterval(screenshotInterval);
  }, []);

  const handleAutomatedLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }
    
    setAutomatedLoginLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/test-browser/automated-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAutomationContinued(true);
        fetchScreenshot(); // Refresh screenshot to show logged in state
        // Clear credentials for security
        setUsername('');
        setPassword('');
        setShowAutomatedLogin(false);
      } else {
        setError(result.message || 'Automated login failed');
      }
    } catch (err: any) {
      setError('Failed to perform automated login');
      console.error('Automated login error:', err);
    } finally {
      setAutomatedLoginLoading(false);
    }
  };

  const initializeBrowserSession = async () => {
    try {
      // First connect to browser
      const connectResponse = await fetch('/api/test-browser/test-connection', {
        method: 'POST'
      });
      const connectResult = await connectResponse.json();
      
      if (connectResult.success) {
        // Navigate to X login page
        await fetch('/api/test-browser/navigate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://x.com/i/flow/login' })
        });
        
        // Wait a moment then start taking screenshots
        setTimeout(fetchScreenshot, 2000);
      }
    } catch (error: any) {
      console.error('Browser initialization failed:', error);
      setError('Failed to initialize browser session');
    }
  };

  const fetchLiveViewUrl = async () => {
    try {
      const response = await fetch('/api/test-browser/live-view-url');
      const result = await response.json();
      
      if (result.success && result.liveViewUrl) {
        setLiveViewUrl(result.liveViewUrl);
      } else {
        setError('Unable to load live browser view');
      }
    } catch (err: any) {
      console.error('Failed to fetch live view URL:', err);
      setError('Failed to connect to browser session');
    }
  };

  const handleScreenshotClick = async (event: React.MouseEvent<HTMLImageElement>) => {
    if (clicking) return;
    
    setClicking(true);
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 1400; // Scale to browser width
    const y = ((event.clientY - rect.top) / rect.height) * 900;   // Scale to browser height
    
    try {
      // Triple click to select all text in field first
      await fetch('/api/test-browser/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'click', x: Math.round(x), y: Math.round(y) })
      });
      
      // Small delay for focus
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Select all content in the field (Ctrl+A)
      await fetch('/api/test-browser/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'key', key: 'Control+a' })
      });
      
      console.log(`Clicked and selected field at ${Math.round(x)}, ${Math.round(y)}`);
    } catch (err: any) {
      console.error('Click error:', err);
    } finally {
      setTimeout(() => setClicking(false), 500);
    }
  };

  const continueAutomation = async () => {
    setContinuingAutomation(true);
    setError('');
    
    try {
      const response = await fetch('/api/test-browser/continue-automation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAutomationContinued(true);
        setTimeout(() => {
          // Keep the tab open to show live automation
        }, 2000);
      } else {
        setError(result.message || 'Failed to continue automation');
      }
    } catch (err: any) {
      setError('Network error: ' + err.message);
    } finally {
      setContinuingAutomation(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Instructions Panel */}
            <div className="lg:col-span-1">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-400" />
                    Manual Login Required
                  </CardTitle>
                  <CardDescription className="text-slate-300">
                    Please complete your X/Twitter login in the live browser view
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="mb-4">
                    <Button
                      onClick={() => setShowAutomatedLogin(!showAutomatedLogin)}
                      variant="outline"
                      className="w-full text-blue-400 border-blue-400 hover:bg-blue-400/10"
                    >
                      {showAutomatedLogin ? 'Switch to Manual Login' : 'Use Automated Login'}
                    </Button>
                  </div>

                  {showAutomatedLogin ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">X/Twitter Username</label>
                        <Input
                          type="text"
                          placeholder="Enter your username or email"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Password</label>
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <Button
                        onClick={handleAutomatedLogin}
                        disabled={automatedLoginLoading || !username.trim() || !password.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {automatedLoginLoading ? 'Logging In...' : 'Automated Login'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-slate-300">
                      <p><strong>Step 1:</strong> Use the live browser on the right to log in to X/Twitter</p>
                      <p><strong>Step 2:</strong> Complete any required verification steps</p>
                      <p><strong>Step 3:</strong> Once logged in, click "Continue Automation" below</p>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t border-slate-700">
                    {automationContinued ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span>Automation continued successfully!</span>
                      </div>
                    ) : (
                      <Button 
                        onClick={continueAutomation}
                        disabled={continuingAutomation || !liveViewUrl}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      >
                        {continuingAutomation ? 'Continuing...' : 'Continue Automation'}
                      </Button>
                    )}
                    
                    {error && (
                      <div className="mt-3 text-red-400 text-sm">
                        {error}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Live Browser View */}
            <div className="lg:col-span-2">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Live Browser View</CardTitle>
                  <CardDescription className="text-slate-300">
                    Interactive X/Twitter login interface
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {screenshot ? (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                      <img 
                        src={screenshot}
                        alt="Live Browser View"
                        className={`w-full h-full object-contain cursor-crosshair ${clicking ? 'opacity-75' : 'hover:opacity-90'}`}
                        onClick={handleScreenshotClick}
                        style={{ userSelect: 'none' }}
                      />
                      <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs">
                        Live • Interactive
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                        {browserInfo.url ? new URL(browserInfo.url).hostname : 'Loading...'}
                      </div>
                      <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-75 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <span>Click to interact</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowTypeModal(true);
                          }}
                          className="ml-2 p-1 hover:bg-white hover:bg-opacity-20 rounded"
                          title="Type text"
                        >
                          <Keyboard className="w-3 h-3" />
                        </button>
                      </div>
                      {clicking && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-20">
                          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                            Clicking...
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
                      <div className="text-center text-slate-400">
                        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>Loading live browser view...</p>
                        {error && (
                          <div className="mt-4 text-red-400 text-sm">
                            {error}
                            <button 
                              onClick={fetchLiveViewUrl}
                              className="block mx-auto mt-2 text-purple-400 hover:text-purple-300 underline"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Status Panel */}
          {automationContinued && (
            <div className="mt-6">
              <Card className="bg-green-900/20 border-green-700">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Automation Active</h3>
                    <p className="text-green-300">
                      Keep this tab open to monitor the live automation progress. 
                      The system is now automatically interacting with X/Twitter posts.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Type Text Dialog */}
      <Dialog open={showTypeModal} onOpenChange={setShowTypeModal}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Type Text</DialogTitle>
            <DialogDescription className="text-slate-300">
              Enter text to type into the browser (like username or password)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={typeText}
              onChange={(e) => setTypeText(e.target.value)}
              placeholder="Enter text to type..."
              className="bg-slate-700 border-slate-600 text-white"
              onKeyPress={(e) => e.key === 'Enter' && handleType()}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleType} className="bg-blue-600 hover:bg-blue-700">
                Type Text
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowTypeModal(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}