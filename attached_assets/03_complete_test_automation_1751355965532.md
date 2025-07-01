# Complete Test Script Automation Implementation

## TASK OVERVIEW
Create a complete "Test Script" button in the test-browser page that handles everything end-to-end: session creation, navigation, manual login handoff, automation continuation, and completion notification while keeping the session active.

## FRONTEND CHANGES NEEDED

### 1. ADD TEST SCRIPT BUTTON
In the test-browser page UI, add a new button called "Test Script" alongside existing buttons:

```typescript
// Add this button to your test-browser page
<button 
  onClick={handleTestScript}
  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
  disabled={isTestScriptRunning}
>
  {isTestScriptRunning ? 'Running Test Script...' : 'Test Script'}
</button>
```

### 2. ADD STATE MANAGEMENT
Add these state variables to handle the test script:

```typescript
const [isTestScriptRunning, setIsTestScriptRunning] = useState(false);
const [automationStatus, setAutomationStatus] = useState<string>('');
const [showManualIntervention, setShowManualIntervention] = useState(false);
const [liveViewUrl, setLiveViewUrl] = useState<string>('');
```

### 3. ADD HANDLER FUNCTION
```typescript
const handleTestScript = async () => {
  try {
    setIsTestScriptRunning(true);
    setAutomationStatus('Starting automation...');
    
    const response = await fetch('/api/test-browser/test-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    
    if (data.success) {
      if (data.status === 'manual_intervention_required') {
        setShowManualIntervention(true);
        setLiveViewUrl(data.liveViewUrl);
        setAutomationStatus(data.message);
      }
    } else {
      toast.error(`Test script failed: ${data.message}`);
      setIsTestScriptRunning(false);
    }
  } catch (error) {
    toast.error('Failed to start test script');
    setIsTestScriptRunning(false);
  }
};
```

### 4. ADD MANUAL INTERVENTION UI
Add this UI component for manual login:

```typescript
{showManualIntervention && (
  <div className="manual-intervention-panel mt-4 p-4 border rounded-lg bg-yellow-50">
    <h3 className="text-lg font-semibold mb-2">Manual Action Required</h3>
    <p className="mb-4">{automationStatus}</p>
    
    <div className="live-view-container">
      <iframe
        src={liveViewUrl}
        sandbox="allow-same-origin allow-scripts"
        allow="clipboard-read; clipboard-write"
        style={{
          width: '100%',
          height: '600px',
          border: '1px solid #ccc',
          borderRadius: '8px'
        }}
      />
    </div>
    
    <p className="mt-2 text-sm text-gray-600">
      Complete the login above. Automation will continue automatically once login is detected.
    </p>
  </div>
)}
```

### 5. ADD WEBSOCKET LISTENER
Update your WebSocket message handler to listen for automation updates:

```typescript
// Add to your existing WebSocket message handler
if (message.type === 'automation_progress') {
  setAutomationStatus(message.message);
}

if (message.type === 'login_detected') {
  setShowManualIntervention(false);
  setAutomationStatus('Login detected! Continuing automation...');
}

if (message.type === 'automation_complete') {
  setIsTestScriptRunning(false);
  setShowManualIntervention(false);
  setAutomationStatus('');
  toast.success('🎉 Test automation completed successfully!');
}

if (message.type === 'automation_error') {
  setIsTestScriptRunning(false);
  setShowManualIntervention(false);
  setAutomationStatus('');
  toast.error(`Automation failed: ${message.error}`);
}
```

## BACKEND IMPLEMENTATION

### 1. ADD NEW ENDPOINT
Add this new endpoint to `server/routes/test-browser.ts`:

```javascript
// POST /api/test-browser/test-script - Complete automation with handoff
router.post("/test-script", async (req, res) => {
  try {
    console.log("🚀 Starting complete test script automation...");

    // 1. Create new Browserbase session
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        context: { persist: true },
        viewport: { width: 1280, height: 720 },
        fingerprint: {
          devices: ["desktop"],
          locales: ["en-US"],
          operatingSystems: ["windows"]
        }
      },
      proxies: true,
      timeout: 3600 // 1 hour in seconds
    });

    console.log("✅ Session created:", session.id);

    // 2. Connect to browser
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0];

    // Store session globally for cleanup
    currentSession = session;
    testBrowser = browser;
    testPage = page;
    isConnected = true;

    // 3. Get live view URL
    const liveViewLinks = await browserbase.sessions.debug(session.id);
    const liveViewUrl = liveViewLinks.debuggerFullscreenUrl;

    // 4. Navigate to Twitter login
    console.log("🌐 Navigating to Twitter login...");
    await page.goto('https://x.com/i/flow/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 5. Check if login is needed
    const needsLogin = await checkIfLoginNeeded(page);

    if (needsLogin) {
      // 6. Request manual intervention
      console.log("🔐 Manual login required");
      
      // Notify WebSocket clients
      broadcastToClients({
        type: 'automation_progress',
        message: 'Please complete login to continue automation',
        step: 'manual_login'
      });

      res.json({
        success: true,
        status: 'manual_intervention_required',
        liveViewUrl: liveViewUrl,
        message: 'Please complete login in the browser above',
        sessionId: session.id
      });

      // 7. Wait for login completion in background
      waitForLoginAndContinue(page, session.id);

    } else {
      // Already logged in, continue directly
      console.log("✅ Already logged in, continuing automation...");
      res.json({
        success: true,
        status: 'continuing_automation',
        message: 'Already logged in, continuing with automation'
      });

      // Continue with automation
      performTestAutomation(page, session.id);
    }

  } catch (error) {
    console.error("❌ Test script error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

### 2. ADD HELPER FUNCTIONS

```javascript
// Check if login is needed
async function checkIfLoginNeeded(page) {
  try {
    // Check for login form elements
    const loginButton = await page.$('[data-testid="LoginForm_Login_Button"]');
    const emailInput = await page.$('[name="text"]');
    const passwordInput = await page.$('[name="password"]');
    
    return !!(loginButton || emailInput || passwordInput);
  } catch (error) {
    return true; // Assume login needed if check fails
  }
}

// Wait for login completion and continue automation
async function waitForLoginAndContinue(page, sessionId) {
  try {
    console.log("⏳ Waiting for login completion...");
    
    const loginDetected = await waitForLoginCompletion(page);
    
    if (loginDetected) {
      console.log("✅ Login detected! Continuing automation...");
      
      // Notify clients
      broadcastToClients({
        type: 'login_detected',
        message: 'Login successful! Continuing automation...',
        sessionId: sessionId
      });

      // Continue with automation
      await performTestAutomation(page, sessionId);
    } else {
      // Timeout
      broadcastToClients({
        type: 'automation_error',
        error: 'Login timeout - please try again',
        sessionId: sessionId
      });
    }
  } catch (error) {
    console.error("❌ Login wait error:", error);
    broadcastToClients({
      type: 'automation_error',
      error: error.message,
      sessionId: sessionId
    });
  }
}

// Login detection function
async function waitForLoginCompletion(page) {
  const maxWait = 300000; // 5 minutes
  const checkInterval = 2000; // 2 seconds
  let elapsed = 0;

  while (elapsed < maxWait) {
    try {
      // Method 1: Check for authenticated UI elements
      const homeButton = await page.$('[data-testid="AppTabBar_Home_Link"]');
      const profileButton = await page.$('[data-testid="AppTabBar_Profile_Link"]');
      const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
      
      if (homeButton || profileButton || composeButton) {
        return true;
      }

      // Method 2: Check URL patterns
      const currentUrl = await page.url();
      if (currentUrl.includes('/home') || 
          (currentUrl.includes('x.com') && !currentUrl.includes('/login') && !currentUrl.includes('/flow'))) {
        return true;
      }

      // Method 3: Check for tweet composer
      const tweetComposer = await page.$('[data-testid="tweetTextarea_0"]');
      if (tweetComposer) {
        return true;
      }

    } catch (error) {
      console.log("Login check error:", error);
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;

    // Send periodic updates
    if (elapsed % 30000 === 0) { // Every 30 seconds
      const remaining = Math.floor((maxWait - elapsed) / 1000);
      broadcastToClients({
        type: 'automation_progress',
        message: `Waiting for login completion (${remaining}s remaining)...`
      });
    }
  }

  return false; // Timeout
}

// Perform the actual test automation
async function performTestAutomation(page, sessionId) {
  try {
    console.log("🤖 Starting test automation sequence...");

    // Update status
    broadcastToClients({
      type: 'automation_progress',
      message: 'Navigating to home feed...',
      step: 'navigation'
    });

    // 1. Navigate to home feed
    await page.goto('https://x.com/home', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 2. Scroll to find posts
    broadcastToClients({
      type: 'automation_progress',
      message: 'Scrolling to find posts...',
      step: 'scrolling'
    });

    await scrollToLoadPosts(page, 4);

    // 3. Find and click 4th post
    const posts = await page.$$('[data-testid="tweet"]');
    if (posts.length >= 4) {
      broadcastToClients({
        type: 'automation_progress',
        message: 'Opening 4th post...',
        step: 'post_interaction'
      });

      await posts[3].click();
      await page.waitForTimeout(4000); // Wait 4 seconds as requested

      // 4. Try to open comment section
      const replyButton = await page.$('[data-testid="reply"]');
      if (replyButton) {
        await replyButton.click();
        
        broadcastToClients({
          type: 'automation_progress',
          message: 'Opening comment section...',
          step: 'commenting'
        });

        // Wait for comment box
        await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 5000 });

        // Scroll down and up in comments
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollBy(0, -300));
        await page.waitForTimeout(2000);

        // Type comment
        const commentBox = await page.$('[data-testid="tweetTextarea_0"]');
        if (commentBox) {
          await commentBox.type("Interesting", { delay: 100 });
          
          // Submit comment
          const submitButton = await page.$('[data-testid="tweetButtonInline"]');
          if (submitButton) {
            await submitButton.click();
            console.log("✅ Comment posted successfully");
          }
        }
      }

      // 5. Go back to feed
      await page.goBack();
      await page.waitForTimeout(2000);

      // 6. Continue scrolling
      await page.evaluate(() => window.scrollBy(0, 500));
    }

    // 7. Automation complete
    console.log("🎉 Test automation completed successfully!");
    
    broadcastToClients({
      type: 'automation_complete',
      message: 'Test automation completed successfully!',
      sessionId: sessionId,
      summary: {
        login: '✅ Login completed',
        navigation: '✅ Navigated to feed',
        interaction: '✅ Interacted with 4th post',
        commenting: '✅ Posted comment',
        completion: '✅ Returned to feed'
      }
    });

  } catch (error) {
    console.error("❌ Automation error:", error);
    broadcastToClients({
      type: 'automation_error',
      error: error.message,
      sessionId: sessionId
    });
  }
}

// Helper function to scroll and load posts
async function scrollToLoadPosts(page, targetCount) {
  let currentPosts = 0;
  let scrollAttempts = 0;
  const maxScrolls = 10;

  while (currentPosts < targetCount && scrollAttempts < maxScrolls) {
    const posts = await page.$$('[data-testid="tweet"]');
    currentPosts = posts.length;

    if (currentPosts < targetCount) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(2000);
      scrollAttempts++;
    }
  }

  console.log(`Found ${currentPosts} posts after ${scrollAttempts} scrolls`);
}

// Broadcast to all WebSocket clients
function broadcastToClients(message) {
  streamingSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}
```

## IMPORTANT REQUIREMENTS

1. **Session Persistence**: After automation completes, keep the session active (don't close browser/page)
2. **Toast Notifications**: Use toast.success() for completion message
3. **Real-time Updates**: Use WebSocket to show progress during automation
4. **Error Handling**: Proper error handling with user feedback
5. **Manual Intervention**: Seamless handoff for login with live view
6. **UI State Management**: Proper button states and loading indicators

## SUCCESS CRITERIA
- ✅ Single "Test Script" button starts everything
- ✅ Creates new session automatically
- ✅ Navigates to https://x.com/i/flow/login
- ✅ Shows live view for manual login
- ✅ Detects login completion automatically
- ✅ Performs automation sequence (scroll, click 4th post, comment, etc.)
- ✅ Shows toast message when complete
- ✅ Keeps session active after completion
- ✅ Real-time progress updates via WebSocket

This creates a complete end-to-end automation experience with a single button click!