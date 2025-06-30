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

  useEffect(() => {
    // Get live view URL from query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get('liveViewUrl');
    if (url) {
      setLiveViewUrl(decodeURIComponent(url));
    }
  }, []);

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
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <iframe
                        src={liveViewUrl}
                        className="w-full h-full border-0"
                        title="Live Browser View"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
                      <div className="text-center text-slate-400">
                        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>Loading live browser view...</p>
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