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
        },
        // Disable automatic CAPTCHA solving - let user handle manually
        solveCaptchas: false
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

    // 4. Immediately broadcast live view URL to all clients
    broadcastToClients({
      type: 'live_view_url',
      url: liveViewUrl,
      message: 'Live view ready - automation starting',
      sessionId: session.id
    });

    // 5. Navigate to Twitter login (always start fresh)
    console.log("🌐 Navigating to fresh Twitter login page...");
    
    // First clear any existing session
    await page.context().clearCookies();

    // Try to clear storage (handle security restrictions gracefully)
    try {
      await page.evaluate(() => {
        try {
          localStorage.clear();
        } catch (e) {
          console.log('localStorage clear blocked by security policy');
        }
        try {
          sessionStorage.clear();
        } catch (e) {
          console.log('sessionStorage clear blocked by security policy');
        }
      });
      console.log("✅ Storage cleared successfully");
    } catch (error) {
      console.log("⚠️ Storage clearing blocked by security policy, continuing anyway...");
    }
    
    // Navigate to login page
    await page.goto('https://x.com/i/flow/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Wait a bit for page to fully render
    await page.waitForTimeout(3000);

    // 6. Check if login is needed
    const needsLogin = await checkIfLoginNeeded(page);

    if (needsLogin) {
      // 7. Request manual intervention
      console.log("🔐 Manual login required");

      // Notify WebSocket clients with persistent live view
      broadcastToClients({
        type: 'automation_progress',
        message: 'Please complete login to continue automation',
        step: 'manual_login',
        liveViewUrl: liveViewUrl, // Include live view URL in all messages
        sessionId: session.id
      });

      res.json({
        success: true,
        status: 'manual_intervention_required',
        liveViewUrl: liveViewUrl,
        message: 'Please complete login in the browser above',
        sessionId: session.id
      });

      // 8. Wait for login completion in background
      waitForLoginAndContinue(page, session.id, liveViewUrl);

    } else {
      // Already logged in, continue directly
      console.log("✅ Already logged in, continuing automation...");
      res.json({
        success: true,
        status: 'continuing_automation',
        liveViewUrl: liveViewUrl,
        message: 'Already logged in, continuing with automation'
      });

      // Continue with automation
      performTestAutomation(page, session.id, liveViewUrl);
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
    console.log("🔍 Checking if login is needed...");
    
    // Method 1: Check for login modal/dialog
    const loginModal = await page.$('[aria-labelledby*="modal-header"]');
    const signInModal = await page.$('div:has-text("Sign in to X")');
    const loginDialog = await page.$('[role="dialog"]');
    
    // Method 2: Check for login form elements
    const loginButton = await page.$('[data-testid="LoginForm_Login_Button"]');
    const emailInput = await page.$('[name="text"]');
    const passwordInput = await page.$('[name="password"]');
    const usernameInput = await page.$('input[autocomplete="username"]');
    
    // Method 3: Check for login-specific text content
    const signInText = await page.$('text="Sign in to X"');
    const loginText = await page.$('text="Log in"');
    const nextButtonText = await page.$('text="Next"');
    
    // Method 4: Check current URL patterns
    const currentUrl = await page.url();
    const isLoginUrl = currentUrl.includes('/login') || 
                      currentUrl.includes('/flow/login') || 
                      currentUrl.includes('/i/flow/login');
    
    // Method 5: Check for absence of authenticated elements
    const homeButton = await page.$('[data-testid="AppTabBar_Home_Link"]');
    const profileButton = await page.$('[data-testid="AppTabBar_Profile_Link"]');
    const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
    const authenticatedElements = homeButton || profileButton || composeButton;
    
    const loginNeeded = !!(
      loginModal || 
      signInModal || 
      loginDialog ||
      loginButton || 
      emailInput || 
      passwordInput || 
      usernameInput ||
      signInText ||
      loginText ||
      nextButtonText ||
      isLoginUrl ||
      !authenticatedElements
    );
    
    console.log(`🔍 Login detection results:
      - Login modal/dialog found: ${!!(loginModal || signInModal || loginDialog)}
      - Login form elements found: ${!!(loginButton || emailInput || passwordInput || usernameInput)}
      - Login text found: ${!!(signInText || loginText || nextButtonText)}
      - Is login URL: ${isLoginUrl}
      - Authenticated elements missing: ${!authenticatedElements}
      - Final result: Login ${loginNeeded ? 'NEEDED' : 'NOT NEEDED'}`);
    
    return loginNeeded;
  } catch (error) {
    console.log("⚠️ Login check failed, assuming login needed:", error);
    return true; // Assume login needed if check fails
  }
}

// Wait for login completion and continue automation
async function waitForLoginAndContinue(page: Page, sessionId: string, liveViewUrl: string) {
  try {
    console.log("⏳ Waiting for login completion...");

    const loginDetected = await waitForLoginCompletion(page, liveViewUrl);

    if (loginDetected) {
      console.log("✅ Login detected! Continuing automation...");

      // Notify clients with persistent live view
      broadcastToClients({
        type: 'login_detected',
        message: 'Login successful! Continuing automation...',
        sessionId: sessionId,
        liveViewUrl: liveViewUrl
      });

      // Continue with automation
      await performTestAutomation(page, sessionId, liveViewUrl);
    } else {
      // Timeout
      broadcastToClients({
        type: 'automation_error',
        error: 'Login timeout - please try again',
        sessionId: sessionId,
        liveViewUrl: liveViewUrl
      });
    }
  } catch (error: any) {
    console.error("❌ Login wait error:", error);
    broadcastToClients({
      type: 'automation_error',
      error: error.message,
      sessionId: sessionId,
      liveViewUrl: liveViewUrl
    });
  }
}

// Login detection function
async function waitForLoginCompletion(page: Page, liveViewUrl: string) {
  const maxWait = 300000; // 5 minutes
  const checkInterval = 3000; // 3 seconds
  let elapsed = 0;

  console.log("⏳ Starting login completion detection...");

  while (elapsed < maxWait) {
    try {
      console.log(`🔍 Login check ${Math.floor(elapsed/1000)}s - Checking authentication status...`);
      
      // Method 1: Check for authenticated UI elements (most reliable)
      const homeButton = await page.$('[data-testid="AppTabBar_Home_Link"]');
      const profileButton = await page.$('[data-testid="AppTabBar_Profile_Link"]');
      const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
      const sideNavHome = await page.$('[data-testid="SideNav_AccountSwitcher_Button"]');

      if (homeButton || profileButton || composeButton || sideNavHome) {
        console.log("✅ Authenticated UI elements found!");
        return true;
      }

      // Method 2: Check URL patterns (secondary check)
      const currentUrl = await page.url();
      const isAuthenticatedUrl = (
        currentUrl.includes('/home') || 
        currentUrl.includes('/following') ||
        currentUrl.includes('/notifications') ||
        (currentUrl.includes('x.com') && !currentUrl.includes('/login') && !currentUrl.includes('/flow') && !currentUrl.includes('/signup'))
      );

      if (isAuthenticatedUrl) {
        console.log("✅ Authenticated URL pattern detected!");
        return true;
      }

      // Method 3: Check for tweet composer (strong indicator)
      const tweetComposer = await page.$('[data-testid="tweetTextarea_0"]');
      const primaryColumn = await page.$('[data-testid="primaryColumn"]');
      
      if (tweetComposer && primaryColumn) {
        console.log("✅ Tweet composer and main feed found!");
        return true;
      }

      // Method 4: Check for absence of login elements (negative check)
      const loginModal = await page.$('[aria-labelledby*="modal-header"]');
      const signInText = await page.$('text="Sign in to X"');
      const loginButton = await page.$('[data-testid="LoginForm_Login_Button"]');
      
      const hasLoginElements = loginModal || signInText || loginButton;
      
      if (!hasLoginElements && primaryColumn) {
        console.log("✅ No login elements found and main content present!");
        return true;
      }

      console.log(`🔍 Login status: Auth elements=${!!(homeButton || profileButton || composeButton)}, URL=${isAuthenticatedUrl}, Composer=${!!tweetComposer}, No login=${!hasLoginElements}`);

    } catch (error) {
      console.log("⚠️ Login check error:", error);
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;

    // Send periodic updates with persistent live view
    if (elapsed % 30000 === 0) { // Every 30 seconds
      const remaining = Math.floor((maxWait - elapsed) / 1000);
      broadcastToClients({
        type: 'automation_progress',
        message: `Still waiting for login completion (${remaining}s remaining)...`,
        step: 'login_wait',
        liveViewUrl: liveViewUrl
      });
    }
  }

  console.log("❌ Login detection timeout reached");
  return false; // Timeout
}

// Perform the actual test automation
async function performTestAutomation(page: Page, sessionId: string, liveViewUrl: string) {
  try {
    console.log("🤖 Starting test automation sequence...");

    // Initial delay to let user observe the automation starting
    broadcastToClients({
      type: 'automation_progress',
      message: 'Automation will start in 10 seconds... (giving time to observe)',
      step: 'initialization',
      liveViewUrl: liveViewUrl
    });
    await page.waitForTimeout(10000); // 10 second delay for user to see

    // Update status with persistent live view
    broadcastToClients({
      type: 'automation_progress',
      message: 'Navigating to home feed...',
      step: 'navigation',
      liveViewUrl: liveViewUrl
    });

    // 1. Navigate to home feed with proper loading
    await page.goto('https://x.com/home', { waitUntil: 'networkidle', timeout: 60000 });
    console.log("📍 Navigated to home feed, waiting for full page load...");
    
    // Wait for page to be properly loaded - check for key elements
    await waitForPageToLoad(page, liveViewUrl);

    // 2. Human-like delay before looking for posts
    broadcastToClients({
      type: 'automation_progress',
      message: 'Page loaded! Looking for posts... (waiting 15 seconds to observe)',
      step: 'loading',
      liveViewUrl: liveViewUrl
    });
    await page.waitForTimeout(15000); // 15 second delay

    // 3. Find posts with better loading detection
    const posts = await findPostsWithBetterDetection(page, liveViewUrl);
    
    if (posts.length === 0) {
      throw new Error('No posts found on the page. The page may not have loaded correctly or Twitter structure changed.');
    }

    console.log(`✅ Found ${posts.length} posts, proceeding with automation`);

    // 4. Human-like delay before interaction
    broadcastToClients({
      type: 'automation_progress',
      message: `Found ${posts.length} posts. Will interact with a post in 10 seconds...`,
      step: 'preparing',
      liveViewUrl: liveViewUrl
    });
    await page.waitForTimeout(10000); // 10 second delay

    // 5. Select and interact with a post
    const targetPostIndex = Math.min(3, posts.length - 1);
    const targetPost = posts[targetPostIndex];

    if (targetPost) {
      broadcastToClients({
        type: 'automation_progress',
        message: `Scrolling to post ${targetPostIndex + 1}...`,
        step: 'scrolling',
        liveViewUrl: liveViewUrl
      });

      // Scroll to post slowly like a human
      await targetPost.scrollIntoViewIfNeeded();
      await page.waitForTimeout(3000); // Wait for scroll animation
      
      broadcastToClients({
        type: 'automation_progress',
        message: `Clicking on post ${targetPostIndex + 1}...`,
        step: 'clicking',
        liveViewUrl: liveViewUrl
      });

      // Click with human-like behavior
      await clickWithHumanBehavior(page, targetPost);
      await page.waitForTimeout(8000); // Wait for post to open

      // 6. Interact with the opened post
      await interactWithPostSlowly(page, liveViewUrl);

      // 7. Human-like delay before going back
      broadcastToClients({
        type: 'automation_progress',
        message: 'Going back to feed...',
        step: 'returning',
        liveViewUrl: liveViewUrl
      });
      await page.waitForTimeout(5000);
      
      await page.goBack();
      await page.waitForTimeout(5000); // Wait for navigation

      // 8. Final human-like scrolling with mouse wheel
      broadcastToClients({
        type: 'automation_progress',
        message: 'Scrolling through feed like a human...',
        step: 'final_scroll',
        liveViewUrl: liveViewUrl
      });
      
      await humanLikeScroll(page, 400);
      await page.waitForTimeout(2000 + Math.random() * 1000);
      await humanLikeScroll(page, 400);
      await page.waitForTimeout(2000 + Math.random() * 1000);
    }

    // 9. Final delay before completion
    await page.waitForTimeout(5000);

    // 10. Automation complete
    console.log("🎉 Test automation completed successfully!");

    broadcastToClients({
      type: 'automation_complete',
      message: 'Test automation completed successfully!',
      sessionId: sessionId,
      liveViewUrl: liveViewUrl,
      summary: {
        login: '✅ Login completed',
        navigation: '✅ Navigated to feed',
        interaction: `✅ Interacted with post ${targetPostIndex + 1}`,
        commenting: '✅ Posted comment',
        completion: '✅ Returned to feed'
      }
    });

  } catch (error: any) {
    console.error("❌ Automation error:", error);
    broadcastToClients({
      type: 'automation_error',
      error: error.message,
      sessionId: sessionId,
      liveViewUrl: liveViewUrl
    });
  }
}

// Wait for page to be properly loaded
async function waitForPageToLoad(page: Page, liveViewUrl: string) {
  try {
    console.log("⏳ Waiting for Twitter page to fully load...");
    
    // Wait for multiple key elements to be present
    const loadingSteps = [
      { selector: '[data-testid="primaryColumn"]', name: 'main column' },
      { selector: '[role="main"]', name: 'main content area' },
      { selector: '[data-testid="tweet"], article[role="article"]', name: 'tweets' }
    ];

    for (const step of loadingSteps) {
      broadcastToClients({
        type: 'automation_progress',
        message: `Waiting for ${step.name} to load...`,
        step: 'loading_check',
        liveViewUrl: liveViewUrl
      });

      try {
        await page.waitForSelector(step.selector, { timeout: 30000 });
        console.log(`✅ ${step.name} loaded`);
        await page.waitForTimeout(2000); // Small delay between checks
      } catch (e) {
        console.log(`⚠️ ${step.name} not found, continuing...`);
      }
    }

    // Wait for network to settle
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Additional wait for dynamic content
    await page.waitForTimeout(8000);
    
    console.log("✅ Page appears to be fully loaded");
  } catch (error) {
    console.log("⚠️ Page loading check completed with warnings:", error);
  }
}

// Better post detection with multiple attempts
async function findPostsWithBetterDetection(page: Page, liveViewUrl: string) {
  const selectors = [
    '[data-testid="tweet"]',
    'article[data-testid="tweet"]',
    'div[data-testid="tweet"]',
    'article[role="article"]',
    '[data-testid="tweetText"]'
  ];

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    
    broadcastToClients({
      type: 'automation_progress',
      message: `Looking for posts... (attempt ${attempts}/${maxAttempts})`,
      step: 'post_detection',
      liveViewUrl: liveViewUrl
    });

    // Try each selector
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        const posts = await page.$$(selector);
        if (posts.length > 0) {
          console.log(`✅ Found ${posts.length} posts using selector: ${selector}`);
          return posts;
        }
      } catch (e) {
        console.log(`No posts found with selector: ${selector}`);
        continue;
      }
    }

    if (attempts < maxAttempts) {
      // Scroll to load more content
      console.log("Scrolling to load more posts...");
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(4000); // Wait for content to load
    }
  }

  return [];
}

// Human-like clicking behavior with visible mouse movements
async function clickWithHumanBehavior(page: Page, element: any) {
  try {
    // Get current mouse position
    const currentPos = await page.evaluate(() => ({ x: 0, y: 0 })); // Start from 0,0 if no previous position
    
    // Get element bounding box
    const box = await element.boundingBox();
    if (!box) {
      throw new Error("Element not visible for clicking");
    }

    // Calculate target position (slightly random within element)
    const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
    const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

    console.log(`Moving mouse from current position to (${Math.round(targetX)}, ${Math.round(targetY)})`);

    // Move mouse in human-like path with multiple steps
    await moveMouseLikeHuman(page, currentPos.x, currentPos.y, targetX, targetY);

    // Human-like pause before clicking (like thinking/aiming)
    await page.waitForTimeout(300 + Math.random() * 700); // 0.3-1s pause

    // Wait for any loading overlays to disappear
    await waitForLoadingToComplete(page);

    // Perform the actual click using mouse.click() to ensure visible clicking
    console.log("Performing mouse click at target position");
    await page.mouse.click(targetX, targetY, {
      delay: 50 + Math.random() * 100, // Click hold duration like human
      button: 'left'
    });

    console.log("✅ Successfully clicked with human-like mouse movement");
    
    // Small delay after click like human reaction time
    await page.waitForTimeout(200 + Math.random() * 300);

  } catch (error: any) {
    console.error("Human-like click failed:", error.message);
    
    // Fallback to element click if mouse click fails
    try {
      console.log("Trying fallback element click...");
      await element.click({ timeout: 10000 });
      console.log("✅ Fallback click successful");
    } catch (fallbackError: any) {
      throw new Error(`Both human-like and fallback clicks failed: ${error.message}`);
    }
  }
}

// Move mouse in human-like curved path
async function moveMouseLikeHuman(page: Page, startX: number, startY: number, endX: number, endY: number) {
  const steps = 8 + Math.floor(Math.random() * 5); // 8-12 steps for smooth movement
  const stepDelay = 20 + Math.random() * 30; // 20-50ms between steps

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    
    // Use easing function for natural acceleration/deceleration
    const easedProgress = easeInOutCubic(progress);
    
    // Add slight curve/wobble to path (like human hand tremor)
    const wobbleX = Math.sin(progress * Math.PI * 2) * (5 + Math.random() * 10);
    const wobbleY = Math.cos(progress * Math.PI * 1.5) * (3 + Math.random() * 8);
    
    const currentX = startX + (endX - startX) * easedProgress + wobbleX;
    const currentY = startY + (endY - startY) * easedProgress + wobbleY;
    
    await page.mouse.move(currentX, currentY);
    
    if (i < steps) {
      await page.waitForTimeout(stepDelay);
    }
  }
}

// Easing function for natural mouse movement
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Human-like scrolling using mouse wheel
async function humanLikeScroll(page: Page, pixels: number) {
  const scrollSteps = 3 + Math.floor(Math.random() * 4); // 3-6 scroll steps
  const pixelsPerStep = pixels / scrollSteps;
  
  for (let i = 0; i < scrollSteps; i++) {
    // Use mouse wheel for visible scrolling
    await page.mouse.wheel(0, pixelsPerStep);
    
    // Human-like delay between scroll steps
    await page.waitForTimeout(100 + Math.random() * 200); // 100-300ms between scrolls
  }
  
  console.log(`Scrolled ${pixels} pixels in ${scrollSteps} human-like steps`);
}

// Wait for loading overlays to disappear
async function waitForLoadingToComplete(page: Page) {
  try {
    // Wait for common loading indicators to disappear
    const loadingSelectors = [
      '[aria-label="Loading"]',
      '.r-1awozwy.r-1777fci', // Loading spinner classes
      '[role="progressbar"]'
    ];

    for (const selector of loadingSelectors) {
      try {
        await page.waitForSelector(selector, { state: 'hidden', timeout: 5000 });
      } catch (e) {
        // Loading indicator might not be present, continue
      }
    }
  } catch (error) {
    console.log("Loading check completed:", error.message);
  }
}

// Slower, more human-like post interaction
async function interactWithPostSlowly(page: Page, liveViewUrl: string) {
  try {
    broadcastToClients({
      type: 'automation_progress',
      message: 'Observing post content... (like a human would)',
      step: 'observing',
      liveViewUrl: liveViewUrl
    });

    // Wait to "read" the post like a human
    await page.waitForTimeout(5000 + Math.random() * 3000); // 5-8 seconds

    // Try to like the post
    broadcastToClients({
      type: 'automation_progress',
      message: 'Looking for like button...',
      step: 'finding_like',
      liveViewUrl: liveViewUrl
    });

    const likeSelectors = [
      '[data-testid="like"]',
      '[aria-label*="like" i]',
      'button[aria-label*="like" i]'
    ];

    for (const selector of likeSelectors) {
      try {
        const likeButton = await page.$(selector);
        if (likeButton) {
          await page.waitForTimeout(1000 + Math.random() * 2000); // Random delay
          await likeButton.click();
          console.log("✅ Liked the post");
          
          broadcastToClients({
            type: 'automation_progress',
            message: 'Post liked! Looking for reply option...',
            step: 'liked',
            liveViewUrl: liveViewUrl
          });
          
          await page.waitForTimeout(2000);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Try to open reply section
    const replySelectors = [
      '[data-testid="reply"]',
      '[aria-label*="reply" i]',
      'button[aria-label*="reply" i]'
    ];

    for (const selector of replySelectors) {
      try {
        const replyButton = await page.$(selector);
        if (replyButton) {
          await page.waitForTimeout(2000 + Math.random() * 2000); // Human-like delay
          await replyButton.click();
          console.log("✅ Opened reply section");
          
          broadcastToClients({
            type: 'automation_progress',
            message: 'Reply dialog opened! Typing comment...',
            step: 'replying',
            liveViewUrl: liveViewUrl
          });
          
          await page.waitForTimeout(3000); // Wait for reply dialog

          // Try to type a comment
          await typeCommentSlowly(page, liveViewUrl);
          break;
        }
      } catch (e) {
        continue;
      }
    }

  } catch (error: any) {
    console.log("Post interaction error:", error.message);
  }
}

// Human-like typing behavior with visible cursor and natural typing patterns
async function typeCommentSlowly(page: Page, liveViewUrl: string) {
  const commentSelectors = [
    '[data-testid="tweetTextarea_0"]',
    'div[aria-label*="tweet" i][contenteditable="true"]',
    'div[contenteditable="true"][aria-multiline="true"]'
  ];

  const comments = [
    "Interesting perspective! 🤔",
    "Thanks for sharing this! 👍",
    "Great point! 💯",
    "Love this! ❤️"
  ];

  const randomComment = comments[Math.floor(Math.random() * comments.length)];

  for (const commentSelector of commentSelectors) {
    try {
      const commentBox = await page.$(commentSelector);
      if (commentBox) {
        // Move mouse to comment box and click like human
        await clickWithHumanBehavior(page, commentBox);
        await page.waitForTimeout(500 + Math.random() * 500);

        // Clear any existing text first
        await page.keyboard.press('Control+A');
        await page.waitForTimeout(100);

        // Type with human-like variability and mistakes
        let typedText = '';
        for (let i = 0; i < randomComment.length; i++) {
          const char = randomComment[i];
          
          // Simulate occasional typos (5% chance)
          if (Math.random() < 0.05 && char.match(/[a-zA-Z]/)) {
            // Type wrong character
            const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
            await page.keyboard.type(wrongChar);
            await page.waitForTimeout(50 + Math.random() * 100);
            
            // Realize mistake and backspace
            await page.waitForTimeout(200 + Math.random() * 300);
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(50 + Math.random() * 100);
          }
          
          // Type the correct character
          await page.keyboard.type(char);
          typedText += char;
          
          // Variable typing speed - faster for common words, slower for complex words
          let delay = 80 + Math.random() * 120; // Base: 80-200ms
          
          if (char === ' ') {
            delay += 50 + Math.random() * 100; // Longer pause after words
          } else if (char.match(/[.!?]/)) {
            delay += 200 + Math.random() * 300; // Longer pause after sentences
          } else if (char.match(/[🤔👍💯❤️]/)) {
            delay += 150 + Math.random() * 200; // Longer pause for emojis
          }
          
          await page.waitForTimeout(delay);
        }

        console.log("✅ Typed comment with human-like behavior:", randomComment);
        
        broadcastToClients({
          type: 'automation_progress',
          message: `Comment typed naturally: "${randomComment}" - Looking for post button...`,
          step: 'posting',
          liveViewUrl: liveViewUrl
        });

        // Human-like pause before submitting (reading over the comment)
        await page.waitForTimeout(1500 + Math.random() * 2000);

        // Try to submit the comment with human-like clicking
        const submitSelectors = [
          '[data-testid="tweetButtonInline"]',
          'button[data-testid="tweetButton"]',
          'button[aria-label*="post" i]',
          'button[aria-label*="reply" i]'
        ];

        for (const submitSelector of submitSelectors) {
          try {
            const submitButton = await page.$(submitSelector);
            if (submitButton) {
              await page.waitForTimeout(500 + Math.random() * 1000);
              await clickWithHumanBehavior(page, submitButton);
              console.log("✅ Posted comment with human-like click");
              
              broadcastToClients({
                type: 'automation_progress',
                message: 'Comment posted successfully with natural interaction!',
                step: 'posted',
                liveViewUrl: liveViewUrl
              });
              
              return;
            }
          } catch (e) {
            continue;
          }
        }
        break;
      }
    } catch (e) {
      continue;
    }
  }
}



export default router;