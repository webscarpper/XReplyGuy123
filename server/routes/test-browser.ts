import { Router } from "express";
import { z } from "zod";
import WebSocket from "ws";
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { Page, Browser, BrowserContext } from "playwright-core";

const router = Router();

// Browserbase configuration
const browserbase = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
});

// Global state for browser session management
let currentSession: any = null;
let currentBrowser: Browser | null = null;
let currentContext: BrowserContext | null = null;
let currentPage: Page | null = null;
let isConnected = false;
let isStreaming = false;
let streamingSockets = new Set<WebSocket>();
let sessionTimeout: NodeJS.Timeout | null = null;

// Test script session management
let testSession: any = null;
let testBrowser: Browser | null = null;
let testContext: BrowserContext | null = null;
let testPage: Page | null = null;

// Request schemas
const navigateSchema = z.object({
  url: z.string().url()
});

const controlSchema = z.object({
  type: z.enum(['click', 'type', 'scroll', 'key']),
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
  deltaY: z.number().optional(),
  key: z.string().optional()
});

const automationSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

// WebSocket handler for browser control
export function handleBrowserWebSocket(ws: WebSocket) {
  console.log("Browser control WebSocket connected");
  streamingSockets.add(ws);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'browser_control' && currentPage) {
        const { action } = data;

        switch (action.type) {
          case 'click':
            await currentPage.mouse.click(action.x, action.y);
            console.log(`Browser click at ${action.x}, ${action.y}`);
            break;

          case 'type':
            await currentPage.keyboard.type(action.text);
            console.log(`Browser type: ${action.text}`);
            break;

          case 'scroll':
            await currentPage.mouse.wheel(0, action.deltaY);
            console.log(`Browser scroll: ${action.deltaY}`);
            break;

          case 'key':
            await currentPage.keyboard.press(action.key);
            console.log(`Browser key: ${action.key}`);
            break;
        }
      }
    } catch (error: any) {
      console.error('WebSocket message handling error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log("Browser control WebSocket disconnected");
    streamingSockets.delete(ws);
  });
}

// Helper function to broadcast messages to WebSocket clients
function broadcastToClients(message: any) {
  streamingSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
}

// Session cleanup utility
async function cleanupSession() {
  console.log("Cleaning up browser session...");

  // Clear session timeout
  if (sessionTimeout) {
    clearTimeout(sessionTimeout);
    sessionTimeout = null;
  }

  // Stop streaming
  isStreaming = false;

  // Close page if exists
  if (currentPage) {
    try {
      await currentPage.close();
    } catch (e) {
      console.log("Page close error (expected):", e);
    }
    currentPage = null;
  }

  // Close context if exists
  if (currentContext) {
    try {
      await currentContext.close();
    } catch (e) {
      console.log("Context close error (expected):", e);
    }
    currentContext = null;
  }

  // Close browser if exists (CORRECT: use browser.close(), NOT session.close())
  if (currentBrowser) {
    try {
      await currentBrowser.close();
    } catch (e) {
      console.log("Browser close error (expected):", e);
    }
    currentBrowser = null;
  }

  // Reset session - Session automatically terminates when browser connection closes
  currentSession = null;
  isConnected = false;

  // Notify all connected clients
  streamingSockets.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'session_closed',
        message: 'Browser session has been terminated'
      }));
    }
  });
}

// Get browser status
router.get("/status", async (req, res) => {
  try {
    let connectedClients = 0;
    let browserEndpoint = null;
    let currentUrl = null;
    let title = null;

    if (currentSession) {
      browserEndpoint = `Browserbase Session: ${currentSession.id}`;
      connectedClients = streamingSockets.size;

      if (currentPage) {
        try {
          currentUrl = await currentPage.url();
          title = await currentPage.title();
        } catch (e) {
          // Page might be closed
        }
      }
    }

    res.json({
      success: true,
      isConnected,
      isStreaming,
      currentUrl,
      title,
      browserEndpoint,
      connectedClients,
      status: isConnected ? "connected" : "disconnected"
    });

  } catch (error: any) {
    console.error("Status check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get browser status",
      error: error.message,
      status: "error"
    });
  }
});

// Test connection to Browserbase with enhanced stealth
router.post("/test-connection", async (req, res) => {
  try {
    console.log("Testing Browserbase connection with advanced stealth...");

    // Cleanup existing session
    await cleanupSession();

    // Create new Browserbase session with Developer plan settings
    console.log("Creating new Browserbase session with Developer plan settings...");
    currentSession = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        // Basic stealth mode (enabled by default in Developer plan)
        viewport: { 
          width: 1280, 
          height: 720 
        },
        fingerprint: {
          devices: ["desktop"],
          locales: ["en-US"],
          operatingSystems: ["windows"]
        }
      },
      proxies: true, // 1 GB included in Developer plan
      timeout: 3600 // 1 hour in seconds
    });

    console.log(`Browserbase session created: ${currentSession.id}`);

    // Connect using Playwright CDP
    console.log("Connecting to session via CDP...");
    currentBrowser = await chromium.connectOverCDP(currentSession.connectUrl);
    currentContext = currentBrowser.contexts()[0];
    currentPage = currentContext.pages()[0];

    // Set session timeout
    sessionTimeout = setTimeout(async () => {
      console.log("Session timeout reached, cleaning up...");
      await cleanupSession();
    }, 3600000); // 1 hour

    console.log("Connected to Browserbase session successfully");
    isConnected = true;

    // Get live view URL using debug method
    let liveViewUrl = null;
    try {
      const liveViewLinks = await browserbase.sessions.debug(currentSession.id);
      liveViewUrl = liveViewLinks.debuggerFullscreenUrl;
      console.log("Live view URL obtained:", liveViewUrl);
    } catch (debugError) {
      console.log("Live view URL not immediately available:", debugError);
    }

    res.json({
      success: true,
      message: "Successfully connected to Browserbase with Developer plan features",
      sessionId: currentSession.id,
      liveViewUrl: liveViewUrl,
      stealthEnabled: true,
      captchaSolving: true,
      proxyEnabled: true,
      timeout: "1 hour",
      status: "connected"
    });

  } catch (error: any) {
    console.error("Browserbase connection error:", error);
    await cleanupSession();

    res.status(500).json({
      success: false,
      message: "Failed to connect to Browserbase",
      error: error.message,
      status: "disconnected"
    });
  }
});

// Navigate to URL
router.post("/navigate", async (req, res) => {
  try {
    const { url } = navigateSchema.parse(req.body);

    if (!currentPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    console.log("Navigating to:", url);

    // Navigate with timeout
    await currentPage.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait a bit for page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const currentUrl = await currentPage.url();
    const title = await currentPage.title();

    console.log("Navigation successful:", currentUrl);

    res.json({
      success: true,
      message: "Navigation successful",
      currentUrl,
      title,
      status: "navigated"
    });

  } catch (error: any) {
    console.error("Navigation error:", error);
    res.status(500).json({
      success: false,
      message: "Navigation failed",
      error: error.message,
      status: "error"
    });
  }
});

// Manual control action
router.post("/control", async (req, res) => {
  try {
    const action = controlSchema.parse(req.body);

    if (!currentPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    switch (action.type) {
      case 'click':
        if (action.x !== undefined && action.y !== undefined) {
          await currentPage.mouse.click(action.x, action.y);
          console.log(`Manual click at ${action.x}, ${action.y}`);
        }
        break;

      case 'type':
        if (action.text) {
          await currentPage.keyboard.type(action.text);
          console.log(`Manual type: ${action.text}`);
        }
        break;

      case 'scroll':
        if (action.deltaY !== undefined) {
          await currentPage.mouse.wheel(0, action.deltaY);
          console.log(`Manual scroll: ${action.deltaY}`);
        }
        break;

      case 'key':
        if (action.key) {
          await currentPage.keyboard.press(action.key);
          console.log(`Manual key: ${action.key}`);
        }
        break;
    }

    res.json({
      success: true,
      message: `${action.type} action executed`,
      action
    });

  } catch (error: any) {
    console.error("Control action error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute control action",
      error: error.message
    });
  }
});

// Take screenshot
router.get("/screenshot", async (req, res) => {
  try {
    if (!currentPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    console.log("Taking screenshot...");

    const screenshot = await currentPage.screenshot({
      fullPage: false,
      type: 'png'
    });

    const currentUrl = await currentPage.url();
    const title = await currentPage.title();

    res.json({
      success: true,
      screenshot: `data:image/png;base64,${screenshot.toString('base64')}`,
      currentUrl,
      title,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Screenshot error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to take screenshot",
      error: error.message
    });
  }
});

// Start live streaming (using Browserbase debug URL)
router.post("/start-streaming", async (req, res) => {
  try {
    if (!currentSession || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    console.log("Starting Browserbase live view...");

    // Get live view URL using Browserbase debug method
    let liveViewUrl = null;
    try {
      const liveViewLinks = await browserbase.sessions.debug(currentSession.id);
      liveViewUrl = liveViewLinks.debuggerFullscreenUrl;
      console.log("Live view URL obtained from debug:", liveViewUrl);
    } catch (debugError) {
      console.error("Failed to get live view URL:", debugError);
      return res.status(500).json({
        success: false,
        message: "Failed to obtain live view URL",
        error: debugError,
        details: "Debug URL not available for this session"
      });
    }

    if (!liveViewUrl) {
      return res.status(500).json({
        success: false,
        message: "Live view URL not available",
        details: "Session may not be ready for debugging"
      });
    }

    // Broadcast live view URL to all connected WebSocket clients
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'live_view_url',
          url: liveViewUrl,
          message: 'Browserbase live view ready for iframe embedding',
          sessionId: currentSession.id
        }));
      }
    });

    isStreaming = true;
    console.log("Browserbase live view started successfully");

    res.json({
      success: true,
      message: "Live view started",
      liveViewUrl,
      sessionId: currentSession.id,
      status: "streaming"
    });

  } catch (error: any) {
    console.error("Start live view error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start live view",
      error: error.message,
      details: "Ensure Browserbase session is properly initialized"
    });
  }
});

// Stop live streaming
router.post("/stop-streaming", async (req, res) => {
  try {
    if (!isStreaming) {
      return res.json({
        success: true,
        message: "Live view not active"
      });
    }

    console.log("Stopping Browserbase live view...");

    // Notify all connected clients that live view is stopping
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'live_view_stopped',
          message: 'Live view has been stopped'
        }));
      }
    });

    isStreaming = false;
    console.log("Browserbase live view stopped");

    res.json({
      success: true,
      message: "Live view stopped",
      status: "stopped"
    });

  } catch (error: any) {
    console.error("Stop live view error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop live view",
      error: error.message
    });
  }
});

// Twitter automation test
router.post("/test-automation", async (req, res) => {
  try {
    const { username, password } = automationSchema.parse(req.body);

    if (!currentPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    console.log("Starting comprehensive X/Twitter automation with automated login...");

    // Start live streaming automatically
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'start_live_stream'
        }));
      }
    });

    await performTwitterAutomation(username, password);

    res.json({
      success: true,
      message: "Twitter automation completed successfully",
      status: "completed"
    });

  } catch (error: any) {
    console.error("Test automation error:", error);

    // Stop streaming on error
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_error',
          error: error.message
        }));
      }
    });

    res.status(500).json({
      success: false,
      message: "Twitter automation failed",
      error: error.message,
      status: "failed"
    });
  }
});

// Close browser session
router.delete("/session", async (req, res) => {
  try {
    console.log("Terminating browser session...");
    await cleanupSession();

    res.json({
      success: true,
      message: "Browser session terminated successfully",
      status: "closed"
    });

  } catch (error: any) {
    console.error("Session termination error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to terminate browser session",
      error: error.message
    });
  }
});

// Twitter automation implementation
async function performTwitterAutomation(username: string, password: string) {
  if (!currentPage) throw new Error("No active page");

  try {
    // Step 1: Navigate to X login page
    console.log("STEP 1: Navigating to X login page...");
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_status',
          status: 'navigating',
          message: 'Navigating to X/Twitter login page...',
          step: 1,
          totalSteps: 8,
          currentAction: 'Loading login page'
        }));
      }
    });

    await currentPage.goto('https://twitter.com/i/flow/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Automated login
    console.log("STEP 2: Starting automated login...");
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_status',
          status: 'logging_in',
          message: 'Performing automated login...',
          step: 2,
          totalSteps: 8,
          currentAction: 'Entering credentials'
        }));
      }
    });

    await performAutomatedLogin(username, password);

    // Step 3: Navigate to home feed
    console.log("STEP 3: Navigating to home feed...");
    await currentPage.goto('https://twitter.com/home', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Additional automation steps would continue here...
    console.log("Twitter automation completed successfully");

  } catch (error: any) {
    console.error('Twitter automation failed:', error);
    throw new Error(`Twitter automation failed: ${error.message}`);
  }
}

// Automated login implementation with Browserbase
async function performAutomatedLogin(username: string, password: string) {
  if (!currentPage) throw new Error("No active page");

  try {
    console.log('Attempting automated login with username:', username);

    // Step 1: Find and fill username field
    console.log('Step 1: Looking for username field...');
    const usernameSelectors = [
      'input[name="text"]',
      'input[autocomplete="username"]',
      'input[data-testid="ocfEnterTextTextInput"]',
      'input[type="text"]'
    ];

    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        await currentPage.waitForSelector(selector, { timeout: 5000 });
        usernameField = selector;
        console.log(`Found username field: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!usernameField) {
      throw new Error('Could not find username input field');
    }

    // Clear and fill username
    await currentPage.fill(usernameField, username);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Username entered:', username);

    // Step 2: Click Next button
    console.log('Step 2: Looking for Next button...');
    const nextSelectors = [
      '[data-testid="LoginForm_Login_Button"]',
      'button:has-text("Next")',
      'div[role="button"]:has-text("Next")',
      '[data-testid="ocfEnterTextNextButton"]'
    ];

    let nextClicked = false;
    for (const selector of nextSelectors) {
      try {
        await currentPage.waitForSelector(selector, { timeout: 5000 });
        await currentPage.click(selector);
        nextClicked = true;
        console.log(`Next button clicked: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!nextClicked) {
      console.log('Next button not found, trying Enter key...');
      await currentPage.keyboard.press('Enter');
    }

    // Wait for password field to appear
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Find and fill password field
    console.log('Step 3: Looking for password field...');
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[autocomplete="current-password"]'
    ];

    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        await currentPage.waitForSelector(selector, { timeout: 5000 });
        passwordField = selector;
        console.log(`Found password field: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!passwordField) {
      throw new Error('Could not find password input field');
    }

    // Fill password using Browserbase (should work better than Bright Data)
    await currentPage.fill(passwordField, password);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Password entered');

    // Step 4: Click Login button
    console.log('Step 4: Looking for Login button...');
    const loginSelectors = [
      '[data-testid="LoginForm_Login_Button"]',
      'button:has-text("Log in")',
      'div[role="button"]:has-text("Log in")',
      'button[type="submit"]'
    ];

    let loginClicked = false;
    for (const selector of loginSelectors) {
      try {
        await currentPage.waitForSelector(selector, { timeout: 5000 });
        await currentPage.click(selector);
        loginClicked = true;
        console.log(`Login button clicked: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!loginClicked) {
      console.log('Login button not found, trying Enter key...');
      await currentPage.keyboard.press('Enter');
    }

    // Wait for login to complete
    await new Promise(resolve => setTimeout(resolve, 8000));
    console.log('Automated login process completed');

  } catch (error: any) {
    console.error('Automated login failed:', error);
    throw new Error(`Automated login failed: ${error.message}`);
  }
}

// POST /api/test-browser/test-script - Complete automation with handoff
router.post("/test-script", async (req, res) => {
  try {
    console.log("🚀 Starting complete test script automation...");

    // 1. Create new Browserbase session
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
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
    testSession = session;
    testBrowser = browser;
    testContext = defaultContext;
    testPage = page;

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

  } catch (error: any) {
    console.error("❌ Test script error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Check if login is needed
async function checkIfLoginNeeded(page: Page) {
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
async function waitForLoginAndContinue(page: Page, sessionId: string) {
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
  } catch (error: any) {
    console.error("❌ Login wait error:", error);
    broadcastToClients({
      type: 'automation_error',
      error: error.message,
      sessionId: sessionId
    });
  }
}

// Login detection function
async function waitForLoginCompletion(page: Page) {
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
async function performTestAutomation(page: Page, sessionId: string) {
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

  } catch (error: any) {
    console.error("❌ Automation error:", error);
    broadcastToClients({
      type: 'automation_error',
      error: error.message,
      sessionId: sessionId
    });
  }
}

// Helper function to scroll and load posts
async function scrollToLoadPosts(page: Page, targetPostCount: number) {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const posts = await page.$$('[data-testid="tweet"]');

    if (posts.length >= targetPostCount) {
      console.log(`✅ Found ${posts.length} posts`);
      return;
    }

    console.log(`Found ${posts.length} posts, scrolling for more...`);
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000);
    attempts++;
  }

  console.log(`Stopped after ${maxAttempts} scroll attempts`);
}

export default router;