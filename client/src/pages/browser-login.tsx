import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function BrowserLogin() {
  const [, setLocation] = useLocation();
  const [liveViewUrl, setLiveViewUrl] = useState<string>('');
  const [continuingAutomation, setContinuingAutomation] = useState(false);
  const [automationContinued, setAutomationContinued] = useState(false);
  const [error, setError] = useState<string>('');
  const [screenshot, setScreenshot] = useState<string>('');
  const [browserInfo, setBrowserInfo] = useState<{url: string, title: string}>({url: '', title: ''});

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
    // Try to get live view URL from query parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const queryUrl = urlParams.get('liveViewUrl');
    if (queryUrl) {
      setLiveViewUrl(decodeURIComponent(queryUrl));
    } else {
      // Fallback: fetch live view URL from backend
      fetchLiveViewUrl();
    }
    
    // Start fetching screenshots to show live browser state
    fetchScreenshot();
    
    // Refresh screenshot every 3 seconds
    const screenshotInterval = setInterval(fetchScreenshot, 3000);
    
    return () => clearInterval(screenshotInterval);
  }, []);

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
                  <div className="space-y-2 text-sm text-slate-300">
                    <p><strong>Step 1:</strong> Use the live browser on the right to log in to X/Twitter</p>
                    <p><strong>Step 2:</strong> Complete any required verification steps</p>
                    <p><strong>Step 3:</strong> Once logged in, click "Continue Automation" below</p>
                  </div>
                  
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
                  {liveViewUrl ? (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-center p-6">
                        <div className="text-white mb-4">
                          <h3 className="text-lg font-semibold mb-2">Live Browser Session Active</h3>
                          <p className="text-slate-300 text-sm">
                            The browser is running X/Twitter at: <span className="text-blue-400">x.com/i/flow/login</span>
                          </p>
                        </div>
                        
                        <div className="bg-slate-700 rounded-lg p-4 w-full max-w-md">
                          <h4 className="text-white font-medium mb-2">Manual Login Instructions</h4>
                          <p className="text-slate-300 text-sm mb-3">
                            The live browser session is active but embedded view is restricted by Bright Data CORS policy.
                          </p>
                          <div className="space-y-2 text-sm text-slate-300 mb-4">
                            <p>• Browser is navigated to X/Twitter login page</p>
                            <p>• Login manually on your device using your X/Twitter account</p>
                            <p>• Then click "Continue Automation" below</p>
                          </div>
                          <button
                            onClick={() => window.open(liveViewUrl, 'liveBrowser', 'width=1400,height=900,scrollbars=yes,resizable=yes,menubar=no,toolbar=no')}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium mb-2"
                          >
                            Try Opening Live View
                          </button>
                          <p className="text-xs text-slate-400">
                            If live view doesn't work, proceed with manual login on your device
                          </p>
                        </div>
                        
                        <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs">
                          Live
                        </div>
                      </div>
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
    </div>
  );
}