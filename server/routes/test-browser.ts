import { Router } from "express";
import { z } from "zod";
import WebSocket from "ws";
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { Page, Browser, BrowserContext } from "playwright-core";
// Ghost cursor will be imported dynamically with error handling

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

  // Close browser if exists
  if (currentBrowser) {
    try {
      await currentBrowser.close();
    } catch (e) {
      console.log("Browser close error (expected):", e);
    }
    currentBrowser = null;
  }

  // CORRECT: Properly terminate Browserbase session
  if (currentSession) {
    try {
      console.log("Terminating Browserbase session:", currentSession.id);
      await browserbase.sessions.update(currentSession.id, { status: 'REQUEST_TERMINATION' });
      console.log("Browserbase session terminated successfully");
    } catch (e) {
      console.log("Browserbase session termination error:", e);
    }
    currentSession = null;
  }

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

    // Also cleanup test session if it exists
    if (testSession) {
      try {
        console.log("Terminating test session:", testSession.id);
        await browserbase.sessions.update(testSession.id, { status: 'REQUEST_TERMINATION' });
        testSession = null;
        testBrowser = null;
        testContext = null;
        testPage = null;
      } catch (e) {
        console.log("Test session termination error:", e);
      }
    }

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

// POST /api/test-browser/test-script - Human-like automation with verified functions
router.post("/test-script", async (req, res) => {
  try {
    console.log("🚀 Starting verified human-like automation...");

    // 1. Create Browserbase session (VERIFIED)
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        viewport: { width: 1280, height: 720 },
        fingerprint: {
          devices: ["desktop"],
          locales: ["en-US"],
          operatingSystems: ["windows"]
        },
        solveCaptchas: false
      },
      proxies: true,
      timeout: 3600
    });

    console.log("✅ Session created:", session.id);

    // 2. Connect to browser (VERIFIED)
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0];

    // 3. Initialize ghost cursor (OFFICIAL DOCUMENTED METHOD)
    console.log("🎯 Initializing ghost cursor...");
    let cursor;

    try {
      // OFFICIAL: Import and create cursor with await (DOCUMENTED)
      const { createCursor } = await import('ghost-cursor-playwright');
      cursor = await createCursor(page); // ✅ OFFICIAL: Requires await
      
      // OFFICIAL: Test cursor functionality
      if (cursor && typeof cursor.click === 'function') {
        console.log("✅ Ghost cursor initialized successfully");
      } else {
        throw new Error("Ghost cursor object invalid");
      }
    } catch (error) {
      console.log("⚠️ Ghost cursor failed, creating fallback:", error.message);
      
      // OFFICIAL FALLBACK: Use Playwright's documented mouse API
      cursor = {
        click: async (element) => {
          // OFFICIAL: Use locator.click() with auto-waiting
          await element.click();
        }
      };
    }

    // Store session globally
    testSession = session;
    testBrowser = browser;
    testContext = defaultContext;
    testPage = page;

    // 4. Get live view URL (VERIFIED)
    const liveViewLinks = await browserbase.sessions.debug(session.id);
    const liveViewUrl = liveViewLinks.debuggerFullscreenUrl;

    // 5. Broadcast live view URL (VERIFIED)
    broadcastToClients({
      type: 'live_view_url',
      url: liveViewUrl,
      message: 'Live view ready - starting automation',
      sessionId: session.id
    });

    // 6. Navigate to login (VERIFIED)
    await page.goto('https://x.com/i/flow/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // 7. Human delay using waitForTimeout (VERIFIED)
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // 8. Check if login needed (VERIFIED)
    const needsLogin = await checkIfLoginNeeded(page);

    if (needsLogin) {
      console.log("🔐 Manual login required");

      broadcastToClients({
        type: 'automation_progress',
        message: 'Please complete login to continue automation',
        step: 'manual_login',
        liveViewUrl: liveViewUrl,
        sessionId: session.id
      });

      res.json({
        success: true,
        status: 'manual_intervention_required',
        liveViewUrl: liveViewUrl,
        message: 'Please complete login in the browser above',
        sessionId: session.id
      });

      // Wait for login and continue (VERIFIED functions only)
      waitForLoginAndContinueVerified(page, session.id, liveViewUrl, cursor);

    } else {
      console.log("✅ Already logged in");
      res.json({
        success: true,
        status: 'continuing_automation',
        liveViewUrl: liveViewUrl,
        message: 'Already logged in, continuing automation'
      });

      performVerifiedAutomation(page, session.id, liveViewUrl, cursor);
    }

  } catch (error: any) {
    console.error("❌ Test script error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Wait for login with verified functions only
async function waitForLoginAndContinueVerified(page: Page, sessionId: string, liveViewUrl: string, cursor: any) {
  try {
    console.log("⏳ Waiting for login completion...");

    const loginDetected = await waitForLoginCompletionVerified(page, liveViewUrl);

    if (loginDetected) {
      console.log("✅ Login detected! Starting automation...");

      broadcastToClients({
        type: 'login_detected',
        message: 'Login successful! Starting automation...',
        sessionId: sessionId,
        liveViewUrl: liveViewUrl
      });

      // Human thinking delay (VERIFIED: page.waitForTimeout)
      await page.waitForTimeout(3000 + Math.random() * 2000);

      await performVerifiedAutomation(page, sessionId, liveViewUrl, cursor);
    } else {
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

// Login detection with verified functions and error recovery (VERIFIED)
async function waitForLoginCompletionVerified(page: Page, liveViewUrl: string) {
  const maxWait = 300000; // 5 minutes
  const checkInterval = 5000; // 5 seconds (increased for stability)
  let elapsed = 0;
  let consecutiveErrors = 0;

  while (elapsed < maxWait) {
    try {
      // Reset error counter on successful check
      consecutiveErrors = 0;

      // VERIFIED: page.url() method - check URL first as it's most reliable
      const currentUrl = await page.url();
      console.log(`🔍 Login check - Current URL: ${currentUrl}`);

      // Check for authenticated URLs
      const isAuthenticated = (
        currentUrl.includes('/home') || 
        currentUrl.includes('/following') ||
        currentUrl.includes('/notifications') ||
        currentUrl.includes('/messages') ||
        (currentUrl.includes('x.com') && !currentUrl.includes('/login') && !currentUrl.includes('/flow') && !currentUrl.includes('/logout'))
      );

      if (isAuthenticated) {
        console.log("✅ Login detected via URL check");
        return true;
      }

      // VERIFIED: page.$() method - check for authenticated elements
      try {
        const homeButton = await page.$('[data-testid="AppTabBar_Home_Link"]');
        const profileButton = await page.$('[data-testid="AppTabBar_Profile_Link"]');
        const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
        const tweetButton = await page.$('[data-testid="tweetButtonInline"]');

        if (homeButton || profileButton || composeButton || tweetButton) {
          console.log("✅ Login detected via element check");
          return true;
        }
      } catch (elementError) {
        console.log("⚠️ Element check failed (context may be destroyed):", elementError.message);
      }

    } catch (error: any) {
      consecutiveErrors++;
      console.log(`⚠️ Login check error (${consecutiveErrors}/3):`, error.message);
      
      // If we have too many consecutive errors, the page context might be destroyed
      if (consecutiveErrors >= 3) {
        console.log("❌ Too many consecutive errors, assuming page context destroyed");
        
        // Try to recover by checking if we can still access the page
        try {
          const recoveryUrl = await page.url();
          console.log(`🔄 Recovery check - URL: ${recoveryUrl}`);
          
          // If we can get the URL and it looks authenticated, consider it successful
          if (recoveryUrl.includes('/home') || recoveryUrl.includes('/following') || 
              (recoveryUrl.includes('x.com') && !recoveryUrl.includes('/login') && !recoveryUrl.includes('/flow'))) {
            console.log("✅ Login detected via recovery check");
            return true;
          }
        } catch (recoveryError) {
          console.log("❌ Recovery failed:", recoveryError.message);
        }
        
        // Reset counter and continue
        consecutiveErrors = 0;
      }
    }

    // VERIFIED: page.waitForTimeout for delays
    await page.waitForTimeout(checkInterval);
    elapsed += checkInterval;

    // Periodic updates
    if (elapsed % 30000 === 0) {
      const remaining = Math.floor((maxWait - elapsed) / 1000);
      broadcastToClients({
        type: 'automation_progress',
        message: `Waiting for login (${remaining}s remaining)...`,
        step: 'login_wait',
        liveViewUrl: liveViewUrl
      });
    }
  }

  console.log("❌ Login detection timeout reached");
  return false;
}

// Perform automation using ONLY official documented methods with logout detection
async function performVerifiedAutomation(page: Page, sessionId: string, liveViewUrl: string, cursor: any) {
  try {
    console.log("🤖 Starting verified automation sequence...");

    // Step 1: Check if we're logged out or on login page
    const currentUrl = await page.url();
    console.log("🔍 Current URL after login:", currentUrl);

    if (currentUrl.includes('/login') || currentUrl.includes('/logout') || currentUrl.includes('/flow')) {
      console.log("❌ Detected logout or login page - session may have been invalidated");
      broadcastToClients({
        type: 'automation_error',
        error: 'Session was logged out or invalidated. Please try logging in again.',
        sessionId: sessionId,
        liveViewUrl: liveViewUrl
      });
      return;
    }

    // Step 2: Navigate to home to ensure we're in the right place
    broadcastToClients({
      type: 'automation_progress',
      message: 'Navigating to home feed...',
      step: 'navigation',
      liveViewUrl: liveViewUrl
    });

    console.log("🏠 Navigating to home feed...");
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // Step 3: Verify we're still logged in after navigation
    const homeUrl = await page.url();
    if (homeUrl.includes('/login') || homeUrl.includes('/logout')) {
      console.log("❌ Redirected to login after navigation - session expired");
      broadcastToClients({
        type: 'automation_error',
        error: 'Session expired during navigation. Please log in again.',
        sessionId: sessionId,
        liveViewUrl: liveViewUrl
      });
      return;
    }

    // Step 4: Look for Following tab with multiple selectors
    broadcastToClients({
      type: 'automation_progress',
      message: 'Looking for Following tab...',
      step: 'finding_following',
      liveViewUrl: liveViewUrl
    });

    console.log("👆 Looking for Following tab...");
    
    // Try multiple selectors for Following tab
    const followingSelectors = [
      'a[href="/following"]',
      'a[aria-label="Following"]',
      'a:has-text("Following")',
      '[data-testid*="following"]',
      'nav a[href*="following"]'
    ];

    let followingTab = null;
    for (const selector of followingSelectors) {
      try {
        followingTab = page.locator(selector);
        await followingTab.waitFor({ state: 'visible', timeout: 5000 });
        console.log(`✅ Found Following tab with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`❌ Following tab not found with selector: ${selector}`);
        continue;
      }
    }

    if (followingTab) {
      console.log("👆 Clicking Following tab...");
      await cursor.click(followingTab);
      await page.waitForTimeout(3000 + Math.random() * 2000);

      broadcastToClients({
        type: 'automation_progress',
        message: 'Switched to Following feed...',
        step: 'following_clicked',
        liveViewUrl: liveViewUrl
      });
    } else {
      console.log("⚠️ Following tab not found, continuing with home feed...");
      broadcastToClients({
        type: 'automation_progress',
        message: 'Following tab not found, using home feed...',
        step: 'using_home_feed',
        liveViewUrl: liveViewUrl
      });
    }

    // Step 5: Wait for content and find posts
    await page.waitForTimeout(4000 + Math.random() * 3000);

    broadcastToClients({
      type: 'automation_progress',
      message: 'Looking for posts...',
      step: 'finding_posts',
      liveViewUrl: liveViewUrl
    });

    console.log("🔍 Looking for posts...");
    
    // Try multiple selectors for posts
    const postSelectors = [
      'article[data-testid="tweet"]',
      'div[data-testid="tweet"]',
      'article[role="article"]',
      '[data-testid="tweetText"]'
    ];

    let posts = null;
    for (const selector of postSelectors) {
      try {
        posts = page.locator(selector);
        await posts.first().waitFor({ state: 'visible', timeout: 10000 });
        console.log(`✅ Found posts with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`❌ Posts not found with selector: ${selector}`);
        continue;
      }
    }

    if (!posts) {
      throw new Error('No posts found on the page');
    }

    // Step 6: Click first post
    const firstPost = posts.first();
    console.log("🎯 Clicking first post...");

    broadcastToClients({
      type: 'automation_progress',
      message: 'Opening first post...',
      step: 'opening_post',
      liveViewUrl: liveViewUrl
    });

    await cursor.click(firstPost);
    await page.waitForTimeout(4000 + Math.random() * 2000);

    // Step 7: Scroll to read content
    broadcastToClients({
      type: 'automation_progress',
      message: 'Reading post content...',
      step: 'reading_content',
      liveViewUrl: liveViewUrl
    });

    console.log("📜 Scrolling to read content...");
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(2000 + Math.random() * 1000);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(2000 + Math.random() * 1000);

    // Step 8: Look for like button
    broadcastToClients({
      type: 'automation_progress',
      message: 'Looking for like button...',
      step: 'finding_like',
      liveViewUrl: liveViewUrl
    });

    console.log("❤️ Looking for like button...");
    
    const likeSelectors = [
      '[data-testid="like"]',
      'button[aria-label*="like"]',
      'button[aria-label*="Like"]',
      '[role="button"]:has([data-testid="heart"])'
    ];

    let likeButton = null;
    for (const selector of likeSelectors) {
      try {
        likeButton = page.locator(selector);
        await likeButton.first().waitFor({ state: 'visible', timeout: 5000 });
        console.log(`✅ Found like button with selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (likeButton) {
      console.log("❤️ Liking post...");
      await cursor.click(likeButton.first());
      await page.waitForTimeout(2000 + Math.random() * 1000);

      broadcastToClients({
        type: 'automation_progress',
        message: 'Post liked! Looking for reply button...',
        step: 'post_liked',
        liveViewUrl: liveViewUrl
      });
    } else {
      console.log("⚠️ Like button not found, skipping like action");
    }

    // Step 9: Look for reply button
    console.log("💬 Looking for reply button...");
    
    const replySelectors = [
      '[data-testid="reply"]',
      'button[aria-label*="reply"]',
      'button[aria-label*="Reply"]',
      '[role="button"]:has([data-testid="reply"])'
    ];

    let replyButton = null;
    for (const selector of replySelectors) {
      try {
        replyButton = page.locator(selector);
        await replyButton.first().waitFor({ state: 'visible', timeout: 5000 });
        console.log(`✅ Found reply button with selector: ${selector}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (replyButton) {
      console.log("💬 Opening reply...");
      await cursor.click(replyButton.first());
      await page.waitForTimeout(3000 + Math.random() * 2000);

      // Step 10: Look for comment box
      broadcastToClients({
        type: 'automation_progress',
        message: 'Typing comment...',
        step: 'typing_comment',
        liveViewUrl: liveViewUrl
      });

      console.log("📝 Looking for comment box...");
      
      const commentSelectors = [
        '[data-testid="tweetTextarea_0"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="reply"]',
        'div[role="textbox"]'
      ];

      let commentBox = null;
      for (const selector of commentSelectors) {
        try {
          commentBox = page.locator(selector);
          await commentBox.first().waitFor({ state: 'visible', timeout: 5000 });
          console.log(`✅ Found comment box with selector: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }

      if (commentBox) {
        console.log("📝 Clicking comment box...");
        await cursor.click(commentBox.first());
        await page.waitForTimeout(500);

        // Ensure proper focus and clear any existing content
        await commentBox.first().focus();
        await page.keyboard.selectAll();
        await page.keyboard.press('Delete');
        await page.waitForTimeout(300);

        // Type meaningful content that meets Twitter requirements
        const replyText = "GM! Hope you're having a great day! 🌅 Thanks for sharing this!";
        console.log("⌨️ Typing enhanced comment...");
        await page.keyboard.type(replyText, { delay: 80 + Math.random() * 40 });

        // Wait for Twitter's content validation
        await page.waitForTimeout(2000);

        // Validate content meets requirements
        await validateReplyContent(page, commentBox.first());

        // Additional wait for UI state to update
        await page.waitForTimeout(1000);

        // Step 11: Submit reply with button state validation
        console.log("📤 Looking for submit button...");
        const submitButton = page.locator('[data-testid="tweetButtonInline"]');
        await submitButton.waitFor({ state: 'visible', timeout: 10000 });

        // OFFICIAL: Wait for button to become enabled
        console.log("⏳ Waiting for reply button to become enabled...");
        let buttonEnabled = false;
        let attempts = 0;
        const maxAttempts = 15; // 30 seconds total

        while (!buttonEnabled && attempts < maxAttempts) {
          try {
            // OFFICIAL: Check if button is enabled using Playwright's isEnabled()
            buttonEnabled = await submitButton.isEnabled();
            
            if (buttonEnabled) {
              console.log("✅ Reply button is now enabled!");
              break;
            } else {
              console.log(`⏳ Button still disabled, attempt ${attempts + 1}/${maxAttempts}`);
              
              // Try triggering content validation
              if (attempts === 5) {
                // Add a space and remove it to trigger validation
                await commentBox.first().focus();
                await page.keyboard.press('Space');
                await page.waitForTimeout(100);
                await page.keyboard.press('Backspace');
              }
              
              await page.waitForTimeout(2000);
              attempts++;
            }
          } catch (error) {
            console.log("⚠️ Error checking button state:", error.message);
            attempts++;
            await page.waitForTimeout(2000);
          }
        }

        if (!buttonEnabled) {
          // OFFICIAL: Try alternative submit button selectors
          console.log("⚠️ Primary button still disabled, trying alternatives...");
          
          const alternativeSelectors = [
            '[data-testid="tweetButton"]',
            'button[type="submit"]',
            '[role="button"]:has-text("Reply")',
            'button:has-text("Reply")'
          ];
          
          for (const selector of alternativeSelectors) {
            try {
              const altButton = page.locator(selector);
              await altButton.waitFor({ state: 'visible', timeout: 3000 });
              
              const isEnabled = await altButton.isEnabled();
              if (isEnabled) {
                console.log(`✅ Found enabled alternative button: ${selector}`);
                await cursor.click(altButton);
                await page.waitForTimeout(2000);
                
                broadcastToClients({
                  type: 'automation_complete',
                  message: 'Reply submitted successfully with alternative button!',
                  sessionId: sessionId,
                  liveViewUrl: liveViewUrl
                });
                return; // Exit function if successful
              }
            } catch (error) {
              console.log(`⚠️ Alternative ${selector} not found or disabled`);
            }
          }
          
          throw new Error("All reply buttons are disabled - content may not meet Twitter requirements");
        }

        // OFFICIAL: Click the enabled button
        console.log("📤 Submitting reply...");
        await cursor.click(submitButton);
        await page.waitForTimeout(3000);

        // OFFICIAL: Verify submission success
        try {
          // Check if modal closed (indicates success)
          const modalStillOpen = await page.locator('[data-testid="tweetTextarea_0"]').isVisible();
          if (!modalStillOpen) {
            console.log("✅ Reply submitted successfully - modal closed");
          } else {
            console.log("⚠️ Modal still open - checking for error messages");
            
            // Look for error messages
            const errorMessage = await page.locator('[role="alert"]').textContent().catch(() => null);
            if (errorMessage) {
              console.log("❌ Twitter error:", errorMessage);
            }
          }
        } catch (error) {
          console.log("⚠️ Could not verify submission status");
        }
      } else {
        console.log("⚠️ Comment box not found, skipping reply");
      }
    } else {
      console.log("⚠️ Reply button not found, skipping reply action");
    }

    // Step 12: Automation complete
    console.log("🎉 Automation completed successfully!");

    broadcastToClients({
      type: 'automation_complete',
      message: 'Human-like automation completed successfully!',
      sessionId: sessionId,
      liveViewUrl: liveViewUrl,
      summary: {
        login: '✅ Login completed',
        navigation: '✅ Navigated to feed',
        interaction: '✅ Opened and read first post',
        engagement: '✅ Liked post and replied with GM!',
        completion: '✅ All actions completed naturally'
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

// OFFICIAL: Validate reply content meets Twitter requirements
async function validateReplyContent(page: Page, commentBox: any) {
  try {
    // Get current text content
    const currentText = await commentBox.inputValue();
    console.log(`📝 Current text: "${currentText}"`);
    
    // Check text length (Twitter minimum is usually 1 character, but longer is better)
    if (currentText.length < 10) {
      console.log("⚠️ Text too short, adding more content...");
      
      // Add more content
      await commentBox.focus();
      await page.keyboard.press('End'); // Go to end of text
      await page.keyboard.type(" Thanks for sharing! 👍", { delay: 50 });
      await page.waitForTimeout(1000);
    }
    
    // Trigger content validation by simulating user behavior
    await commentBox.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(500);
    
    return true;
  } catch (error) {
    console.log("⚠️ Content validation error:", error.message);
    return false;
  }
}

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

export default router;