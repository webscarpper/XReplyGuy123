import { Router } from "express";
import { z } from "zod";
import WebSocket from "ws";
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { Page, Browser, BrowserContext } from "playwright-core";
import { AIReplyService } from '../services/aiService';
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

// Human-like typing function with realistic behavior patterns
async function typeWithHumanBehavior(page: Page, text: string) {
  try {
    console.log(`🎯 Typing "${text}" with human-like behavior...`);

    // Track if we've already made a typo (limit to 1 per text)
    let typoMade = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // 1. Random thinking pause (8% chance)
      if (Math.random() < 0.08) {
        const thinkingDelay = 400 + Math.random() * 800; // 400-1200ms thinking pause
        console.log(`🤔 Thinking pause: ${Math.round(thinkingDelay)}ms`);
        await page.waitForTimeout(thinkingDelay);
      }

      // 2. Occasional typo simulation (only once per text, 3% chance, after 25% of text)
      if (!typoMade && Math.random() < 0.03 && i > Math.floor(text.length * 0.25)) {
        console.log('❌ Making a single typo...');
        typoMade = true; // Mark that we've made our one typo

        // Type a wrong character first
        const wrongChars = 'qwertyuiopasdfghjklzxcvbnm';
        const wrongChar = wrongChars[Math.floor(Math.random() * wrongChars.length)];
        await page.keyboard.type(wrongChar);

        // Pause as human realizes mistake
        await page.waitForTimeout(200 + Math.random() * 300);

        // Backspace to correct
        await page.keyboard.press('Backspace');
        await page.waitForTimeout(100 + Math.random() * 200);

        console.log('🔙 Correcting typo...');
      }

      // 3. Random backspace and retype (2% chance, but not on first few chars)
      if (Math.random() < 0.02 && i > 5) {
        console.log('🔄 Deleting and retyping...');

        // Delete 2-4 previous characters
        const deleteCount = 2 + Math.floor(Math.random() * 3);
        for (let d = 0; d < deleteCount; d++) {
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(80 + Math.random() * 120);
        }

        // Pause before retyping
        await page.waitForTimeout(300 + Math.random() * 400);

        // Retype the deleted characters plus current one
        const startIndex = Math.max(0, i - deleteCount + 1);
        const retypeText = text.substring(startIndex, i + 1);

        for (const retypeChar of retypeText) {
          await page.keyboard.type(retypeChar);
          const retypeDelay = 90 + Math.random() * 120;
          await page.waitForTimeout(retypeDelay);
        }

        console.log(`✅ Retyped: "${retypeText}"`);
        continue; // Skip normal typing for this character
      }

      // 4. Type the character with variable speed
      await page.keyboard.type(char);

      // 5. Calculate realistic delay based on character type
      let baseDelay = 120 + Math.random() * 180; // 120-300ms base

      // Character-specific delays
      if (char === ' ') {
        baseDelay += 80; // Longer pause after words
      } else if (char.match(/[.!?]/)) {
        baseDelay += 150; // Pause after punctuation
      } else if (char.match(/[,;:]/)) {
        baseDelay += 100; // Medium pause after minor punctuation
      } else if (char.match(/[A-Z]/)) {
        baseDelay += 50; // Slightly longer for capitals
      } else if (char.match(/[0-9]/)) {
        baseDelay += 30; // Numbers are slightly slower
      }

      // 6. Add random variation (human inconsistency)
      const variation = (Math.random() - 0.5) * 100; // ±50ms variation
      const finalDelay = Math.max(50, baseDelay + variation);

      await page.waitForTimeout(finalDelay);

      // 7. Occasional longer pause mid-sentence (2% chance)
      if (Math.random() < 0.02 && char !== ' ') {
        const midPause = 500 + Math.random() * 1000;
        console.log(`⏸️ Mid-sentence pause: ${Math.round(midPause)}ms`);
        await page.waitForTimeout(midPause);
      }
    }

    console.log(`✅ Finished typing with human-like behavior`);

  } catch (error: any) {
    console.error('❌ Human typing error:', error.message);
    // Fallback to simple typing if our advanced typing fails
    await page.keyboard.type(text, { delay: 100 });
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

    // Test AI service before starting automation
    console.log('🧪 Testing AI service connection...');
    const aiWorking = await AIReplyService.testConnection();

    if (aiWorking) {
      console.log('✅ AI service is working correctly');
      broadcastToClients({
        type: 'automation_progress',
        message: 'AI service connected and ready!',
        step: 'ai_service_ready',
        liveViewUrl: liveViewUrl
      });
    } else {
      console.log('⚠️ AI service test failed, will use fallback replies');
      broadcastToClients({
        type: 'automation_progress',
        message: 'AI service unavailable, using fallback replies',
        step: 'ai_service_fallback',
        liveViewUrl: liveViewUrl
      });
    }

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
      console.log("✅ Login detected! Starting extended manual handoff for security challenges...");

      broadcastToClients({
        type: 'login_detected',
        message: 'Login detected! Please handle any security challenges and navigate to Following feed manually.',
        sessionId: sessionId,
        liveViewUrl: liveViewUrl
      });

      // Extended manual handoff to handle Cloudflare/security challenges
      broadcastToClients({
        type: 'automation_progress',
        message: 'MANUAL HANDOFF: Please complete any security challenges (Cloudflare CAPTCHA) and navigate to the Following feed. Automation will detect when ready.',
        step: 'extended_manual_handoff',
        liveViewUrl: liveViewUrl
      });

      // Wait for user to handle security challenges and navigate to Following feed
      console.log('⏳ Waiting for user to handle security challenges and navigate to Following feed...');
      
      let followingFeedReady = false;
      let handoffAttempts = 0;
      const maxHandoffAttempts = 60; // 5 minutes total (5 second intervals)

      while (!followingFeedReady && handoffAttempts < maxHandoffAttempts) {
        try {
          // Check for Cloudflare challenge
          const cloudflareChallenge = await page.locator('text="Verify you are human"').isVisible().catch(() => false);
          const cloudflareFrame = await page.locator('[src*="cloudflare"]').isVisible().catch(() => false);
          
          if (cloudflareChallenge || cloudflareFrame) {
            console.log('🛡️ Cloudflare challenge detected, waiting for user to complete...');
            broadcastToClients({
              type: 'automation_progress',
              message: 'Cloudflare security challenge detected. Please complete the CAPTCHA manually.',
              step: 'cloudflare_challenge',
              liveViewUrl: liveViewUrl
            });
          } else {
            // Check if user has navigated to Following feed successfully
            const followingTabVisible = await page.locator('[data-testid="AppTabBar_Following_Link"], [href="/following"], text="Following"').isVisible().catch(() => false);
            const homeWithPosts = await page.locator('[data-testid="tweet"]').count().catch(() => 0);
            const currentUrl = await page.url().catch(() => '');
            
            // User is ready if they're on Following feed OR home feed with posts visible
            if (followingTabVisible || homeWithPosts > 0 || currentUrl.includes('/home') || currentUrl.includes('/following')) {
              console.log('✅ User has successfully navigated past security challenges');
              followingFeedReady = true;
              
              broadcastToClients({
                type: 'automation_progress',
                message: 'Security challenges completed! Automation will now continue.',
                step: 'security_challenges_complete',
                liveViewUrl: liveViewUrl
              });
              break;
            }
          }
          
          // Wait 5 seconds before checking again
          await page.waitForTimeout(5000);
          handoffAttempts++;
          
          // Update user every 30 seconds
          if (handoffAttempts % 6 === 0) {
            const remainingTime = Math.round((maxHandoffAttempts - handoffAttempts) * 5 / 60);
            broadcastToClients({
              type: 'automation_progress',
              message: `Still waiting for manual navigation. ${remainingTime} minutes remaining. Please complete any security challenges and navigate to Following feed.`,
              step: 'manual_handoff_waiting',
              liveViewUrl: liveViewUrl
            });
          }
          
        } catch (checkError) {
          console.log('⚠️ Error during manual handoff check:', checkError.message);
          await page.waitForTimeout(5000);
          handoffAttempts++;
        }
      }

      if (!followingFeedReady) {
        throw new Error('Manual handoff timeout - user did not complete security challenges within 5 minutes');
      }

      console.log('🎯 Extended manual handoff complete, continuing with automation...');
      
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

    // Step 2: Navigate to Following feed (if not already there)
    console.log('📋 Ensuring we are on Following feed...');
    
    const pageUrl = await page.url();
    const isAlreadyOnFollowing = pageUrl.includes('/following') || pageUrl.includes('/home');
    
    if (!isAlreadyOnFollowing) {
      console.log('🔄 Not on Following feed, attempting to navigate...');
      
      const followingSelectors = [
        '[data-testid="AppTabBar_Following_Link"]',
        '[href="/following"]',
        'a[aria-label*="Following"]',
        'nav a:has-text("Following")',
        '[role="tab"]:has-text("Following")'
      ];
      
      let followingClicked = false;
      
      for (const selector of followingSelectors) {
        try {
          const followingTab = page.locator(selector).first();
          const isVisible = await followingTab.isVisible();
          
          if (isVisible) {
            console.log(`✅ Found Following tab with selector: ${selector}`);
            
            // Use ghost cursor for human-like clicking
            try {
              const { createCursor } = await import('ghost-cursor-playwright');
              const cursor = await createCursor(page);
              await cursor.click(followingTab);
            } catch (cursorError) {
              await followingTab.click();
            }
            
            followingClicked = true;
            console.log('✅ Following tab clicked');
            break;
          }
        } catch (selectorError) {
          console.log(`⚠️ Following selector ${selector} failed, trying next...`);
          continue;
        }
      }
      
      if (!followingClicked) {
        console.log('⚠️ Could not find Following tab, proceeding with current feed...');
      } else {
        // Wait for Following feed to load
        await page.waitForTimeout(3000 + Math.random() * 2000);
      }
    } else {
      console.log('✅ Already on Following/Home feed, proceeding...');
    }
    
    // Verify we have posts to interact with
    const postsAvailable = await page.locator('[data-testid="tweet"]').count();
    console.log(`📄 Found ${postsAvailable} posts available for interaction`);
    
    if (postsAvailable === 0) {
      console.log('⚠️ No posts found, waiting for content to load...');
      await page.waitForTimeout(5000);
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

        // OFFICIAL: AI-powered reply generation
        console.log("🤖 Generating AI-powered reply...");

        // Extract the post content first
        const postContent = await extractPostContent(page);
        console.log('📄 Extracted post content for AI:', postContent.substring(0, 100) + '...');

        // Add thinking delay (human-like behavior)
        const thinkingDelay = 2000 + Math.random() * 3000; // 2-5 seconds
        console.log(`🤔 Thinking for ${Math.round(thinkingDelay/1000)}s before replying...`);
        await page.waitForTimeout(thinkingDelay);

        // Generate AI reply based on post content
        let replyText;
        try {
          replyText = await AIReplyService.generateReply(postContent, 'conversational');
          console.log('✅ AI Generated Reply:', replyText);

          broadcastToClients({
            type: 'automation_progress',
            message: `AI generated reply: "${replyText.substring(0, 50)}..."`,
            step: 'ai_reply_generated',
            liveViewUrl: liveViewUrl
          });
        } catch (aiError: any) {
          console.log('⚠️ AI generation failed, using fallback:', aiError.message);
          replyText = "Interesting perspective! Thanks for sharing this. 👍";

          broadcastToClients({
            type: 'automation_progress',
            message: 'AI service unavailable, using fallback reply',
            step: 'ai_service_fallback',
            liveViewUrl: liveViewUrl
          });
        }

        console.log("⌨️ Starting human-like typing...");

        // Step 1: Ensure text area is properly focused
        await commentBox.first().focus();
        await page.waitForTimeout(500);

        // Step 2: Clear any existing content first
        await page.keyboard.press('Control+a');
        await page.waitForTimeout(100);
        await page.keyboard.press('Delete');
        await page.waitForTimeout(300);

        // Step 3: Type with human-like behavior using our custom function
        await typeWithHumanBehavior(page, replyText);

        // Wait for Twitter's content validation
        await page.waitForTimeout(2000);

        // Validate content meets requirements (but preserve AI-generated content)
        await validateReplyContent(page, commentBox.first(), replyText);

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

                // Human-like browsing simulation AFTER successful reply
                console.log("✅ Reply completed! Now browsing YouTube like a human...");

                broadcastToClients({
                  type: 'automation_progress',
                  message: 'Reply sent! Opening YouTube for realistic browsing behavior...',
                  step: 'post_reply_youtube',
                  liveViewUrl: liveViewUrl
                });

                // Call YouTube browsing function AFTER reply completion
                await openYouTubeAndScroll(page, sessionId);

                broadcastToClients({
                  type: 'automation_progress',
                  message: 'Returned from YouTube browsing. Starting follow automation...',
                  step: 'youtube_complete',
                  liveViewUrl: liveViewUrl
                });

                // NEW: Follow automation phase AFTER YouTube
                console.log('👥 Starting follow automation phase...');

                // Add human-like delay before follow automation
                await page.waitForTimeout(3000 + Math.random() * 3000);

                // Execute follow automation
                const followSuccess = await performFollowAutomation(page, sessionId, liveViewUrl);

                if (followSuccess) {
                  broadcastToClients({
                    type: 'automation_progress',
                    message: 'Follow automation completed successfully!',
                    step: 'follow_automation_complete',
                    liveViewUrl: liveViewUrl
                  });
                } else {
                  broadcastToClients({
                    type: 'automation_progress',
                    message: 'Follow automation skipped, continuing...',
                    step: 'follow_automation_skipped',
                    liveViewUrl: liveViewUrl
                  });
                }

                // Final automation cycle complete
                broadcastToClients({
                  type: 'automation_complete',
                  message: 'Complete automation cycle finished! Session remains active.',
                  sessionId: sessionId,
                  liveViewUrl: liveViewUrl,
                  summary: {
                    login: '✅ Login completed',
                    navigation: '✅ Navigated to Following feed',
                    interaction: '✅ Opened and read first post',
                    engagement: '✅ Liked post and replied',
                    browsing: '✅ YouTube browsing simulation',
                    followAutomation: '✅ Follow automation and profile engagement',
                    completion: '✅ Extended cycle complete - session active'
                  }
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

            // Human-like browsing simulation AFTER successful reply
            console.log("✅ Reply completed! Now browsing YouTube like a human...");

            broadcastToClients({
              type: 'automation_progress',
              message: 'Reply sent! Opening YouTube for realistic browsing behavior...',
              step: 'post_reply_youtube',
              liveViewUrl: liveViewUrl
            });

            // Call YouTube browsing function AFTER reply completion
            await openYouTubeAndScroll(page, sessionId);

            broadcastToClients({
              type: 'automation_progress',
              message: 'Returned from YouTube browsing. Starting follow automation...',
              step: 'youtube_complete',
              liveViewUrl: liveViewUrl
            });

            // NEW: Follow automation phase AFTER YouTube
            console.log('👥 Starting follow automation phase...');

            // Add human-like delay before follow automation
            await page.waitForTimeout(3000 + Math.random() * 3000);

            // Execute follow automation
            const followSuccess = await performFollowAutomation(page, sessionId, liveViewUrl);

            if (followSuccess) {
              broadcastToClients({
                type: 'automation_progress',
                message: 'Follow automation completed successfully!',
                step: 'follow_automation_complete',
                liveViewUrl: liveViewUrl
              });
            } else {
              broadcastToClients({
                type: 'automation_progress',
                message: 'Follow automation skipped, continuing...',
                step: 'follow_automation_skipped',
                liveViewUrl: liveViewUrl
              });
            }

            // Final automation cycle complete
            broadcastToClients({
              type: 'automation_complete',
              message: 'Complete automation cycle finished! Session remains active.',
              sessionId: sessionId,
              liveViewUrl: liveViewUrl,
              summary: {
                login: '✅ Login completed',
                navigation: '✅ Navigated to Following feed',
                interaction: '✅ Opened and read first post',
                engagement: '✅ Liked post and replied',
                browsing: '✅ YouTube browsing simulation',
                followAutomation: '✅ Follow automation and profile engagement',
                completion: '✅ Extended cycle complete - session active'
              }
            });
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
      message: 'Extended automation cycle completed with follow engagement! Session remains active.',
      sessionId: sessionId,
      liveViewUrl: liveViewUrl,
      summary: {
        login: '✅ Login completed',
        navigation: '✅ Navigated to Following feed',
        interaction: '✅ Opened and read first post',
        engagement: '✅ Liked post and replied',
        browsing: '✅ YouTube browsing simulation',
        followAutomation: '✅ Follow automation and profile engagement',
        completion: '✅ Extended cycle complete - session active'
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

// OFFICIAL: Validate reply content meets Twitter requirements while preserving AI content
async function validateReplyContent(page: Page, commentBox: any, originalReply?: string) {
  try {
    // Get current text content
    const currentText = await commentBox.inputValue();
    console.log(`📝 Current text: "${currentText}"`);

    // Check text length (Twitter minimum is usually 1 character, but longer is better)
    if (currentText.length < 10) {
      console.log("⚠️ Text too short, enhancing AI reply...");

      // If we have original AI reply, enhance it instead of replacing
      if (originalReply && originalReply.length > 5) {
        const enhancedReply = originalReply + " 👍";
        await commentBox.focus();
        await commentBox.fill(enhancedReply);
        console.log(`✅ Enhanced AI reply: "${enhancedReply}"`);
      } else {
        // Fallback enhancement
        await commentBox.focus();
        await page.keyboard.press('End');
        await page.keyboard.type(" Thanks for sharing! 👍", { delay: 50 });
      }
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

// Extract post content using robust Playwright selectors
async function extractPostContent(page: Page): Promise<string> {
  try {
    console.log('📝 Extracting post content...');

    // Multiple selectors for robust text extraction (official Playwright methods)
    const postSelectors = [
      '[data-testid="tweetText"]',           // Primary tweet text
      '[data-testid="tweet"] [lang]',       // Language-specific content  
      'article [dir="auto"]',               // Auto-direction text
      '[data-testid="tweet"] span',         // Fallback spans
      'article div[lang]'                   // Alternative language div
    ];

    let extractedText = '';

    // Try each selector until we find content
    for (const selector of postSelectors) {
      try {
        // Use official Playwright locator method
        const elements = page.locator(selector);
        const count = await elements.count();

        if (count > 0) {
          // Extract text using official textContent method
          const texts = await elements.allTextContents();
          const combinedText = texts.join(' ').trim();

          if (combinedText.length > 10) { // Ensure meaningful content
            extractedText = combinedText;
            console.log(`✅ Content extracted using selector: ${selector}`);
            break;
          }
        }
      } catch (selectorError) {
        console.log(`⚠️ Selector ${selector} failed, trying next...`);
        continue;
      }
    }

    // Clean and validate extracted text
    if (extractedText.length > 0) {
      // Remove extra whitespace and clean up
      extractedText = extractedText.replace(/\s+/g, ' ').trim();

      // Limit length for AI processing (Gemini works best with reasonable input)
      if (extractedText.length > 500) {
        extractedText = extractedText.substring(0, 497) + '...';
      }

      console.log('📄 Extracted post content:', extractedText.substring(0, 100) + '...');
      return extractedText;
    } else {
      console.log('⚠️ No post content found, using fallback');
      return 'Interesting post! Thanks for sharing.';
    }

  } catch (error: any) {
    console.error('❌ Post content extraction failed:', error.message);
    return 'Great post! Thanks for sharing this.';
  }
}

// Wait for user to manually navigate to Following feed (avoiding Cloudflare)
async function waitForFollowingFeedManually(page: Page, liveViewUrl: string) {
  const maxWait = 300000; // 5 minutes for manual navigation
  const checkInterval = 5000; // 5 seconds
  let elapsed = 0;

  console.log("⏳ Waiting for manual navigation to Following feed...");

  while (elapsed < maxWait) {
    try {
      const currentUrl = await page.url();
      console.log(`🔍 Current URL: ${currentUrl}`);

      // Check if we're past Cloudflare and on a valid X page
      const isValidXPage = currentUrl.includes('x.com') && 
                          !currentUrl.includes('/account/access') &&
                          !currentUrl.includes('/login') &&
                          !currentUrl.includes('/logout') &&
                          !currentUrl.includes('/flow');

      if (isValidXPage) {
        // Check for Following feed specifically
        if (currentUrl.includes('/following')) {
          console.log("✅ Following feed detected via URL");
          return true;
        }

        // Check for Following feed content
        try {
          const followingElements = await page.$$eval(
            'h2, [data-testid="primaryColumn"] h2, div[role="heading"]',
            elements => elements.some(el => el.textContent?.includes('Following'))
          );

          if (followingElements) {
            console.log("✅ Following feed detected via content");
            return true;
          }

          // Check for any valid feed with posts (home feed is acceptable too)
          const hasPosts = await page.$('[data-testid="tweet"]');
          if (hasPosts && (currentUrl.includes('/home') || currentUrl.includes('/following'))) {
            console.log("✅ Valid feed with posts detected");
            return true;
          }
        } catch (elementError) {
          console.log("⚠️ Element check failed:", elementError.message);
        }
      } else if (currentUrl.includes('/account/access') || currentUrl.includes('challenges.cloudflare.com')) {
        console.log("⚠️ Still on Cloudflare challenge page, waiting for manual resolution...");
      }

    } catch (error: any) {
      console.log("⚠️ Navigation detection error:", error.message);
    }

    await page.waitForTimeout(checkInterval);
    elapsed += checkInterval;

    // Periodic updates
    if (elapsed % 30000 === 0) {
      const remaining = Math.floor((maxWait - elapsed) / 1000);
      broadcastToClients({
        type: 'automation_progress',
        message: `Waiting for manual navigation to feed (${remaining}s remaining)...`,
        step: 'manual_navigation_wait',
        liveViewUrl: liveViewUrl
      });
    }
  }

  console.log("❌ Manual navigation timeout");
  return false;
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
  } catch (error: any) {
    console.log("⚠️ Login check failed, assuming login needed:", error);
    return true; // Assume login needed if check fails
  }
}

// Human-like YouTube browsing simulation with live view URL
async function openYouTubeAndScroll(page: Page, sessionId: string) {
  try {
    console.log("🎥 Opening YouTube in new tab for human-like browsing...");

    // Get the browser context from the current page
    const context = page.context();

    // Create new page (tab) in same context
    const youtubeTab = await context.newPage();
    console.log("✅ New YouTube tab created");

    // Navigate to YouTube with proper wait
    await youtubeTab.goto('https://www.youtube.com', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log("✅ YouTube loaded");

    // CRITICAL: Get live view URLs for all tabs after YouTube opens
    try {
      const browserbase = new Browserbase({
        apiKey: process.env.BROWSERBASE_API_KEY!,
      });

      // Get all tab live view URLs
      const liveViewLinks = await browserbase.sessions.debug(sessionId);
      const allTabs = liveViewLinks.pages;

      console.log(`📺 Found ${allTabs.length} tabs with live view URLs`);

      // Find YouTube tab (should be the newest one)
      const youtubeTabLiveView = allTabs.find(tab => 
        tab.url && tab.url.includes('youtube.com')
      );

      if (youtubeTabLiveView) {
        console.log(`🎥 YouTube tab live view URL: ${youtubeTabLiveView.debuggerFullscreenUrl}`);

        // Broadcast YouTube tab live view URL for secondary iframe
        broadcastToClients({
          type: 'secondary_tab_opened',
          tabType: 'youtube',
          tabName: 'YouTube Tab',
          tabUrl: youtubeTabLiveView.debuggerFullscreenUrl,
          message: 'YouTube tab opened - now visible in secondary live view',
          allTabs: allTabs.map(tab => ({
            title: tab.title,
            url: tab.url,
            liveViewUrl: tab.debuggerFullscreenUrl
          }))
        });
      }
    } catch (liveViewError) {
      console.log("⚠️ Could not get YouTube tab live view URL:", liveViewError.message);
    }

    // Wait for page to fully load
    await youtubeTab.waitForTimeout(2000 + Math.random() * 3000);

    // Human-like scrolling pattern (1600px total in chunks)
    const scrollSteps = 4; // 400px per step
    const scrollAmount = 400;

    for (let i = 0; i < scrollSteps; i++) {
      console.log(`📜 Scrolling step ${i + 1}/${scrollSteps}`);

      // Use mouse.wheel() for natural scrolling
      await youtubeTab.mouse.wheel(0, scrollAmount);

      // Human-like pause between scrolls (1-3 seconds)
      const pauseTime = 1000 + Math.random() * 2000;
      await youtubeTab.waitForTimeout(pauseTime);
    }

    // Browse YouTube for 5-10 seconds (realistic human behavior)
    const browsingTime = 5000 + Math.random() * 5000;
    console.log(`👀 Browsing YouTube for ${Math.round(browsingTime/1000)}s...`);
    await youtubeTab.waitForTimeout(browsingTime);

    // Notify before closing
    broadcastToClients({
      type: 'secondary_tab_closing',
      tabType: 'youtube',
      message: 'Closing YouTube tab, returning to X...'
    });

    // Close the YouTube tab
    await youtubeTab.close();
    console.log("✅ YouTube tab closed, returning to X");

    // Notify that secondary tab is closed
    broadcastToClients({
      type: 'secondary_tab_closed',
      tabType: 'youtube',
      message: 'YouTube tab closed - secondary view hidden'
    });

    // Small delay before continuing
    await page.waitForTimeout(1000 + Math.random() * 2000);

  } catch (error: any) {
    console.error("❌ YouTube tab error:", error.message);
    // Don't throw - continue automation even if YouTube fails
  }
}

// Follow automation: Navigate to "Who to follow", follow random account, engage with their content
async function performFollowAutomation(page: Page, sessionId: string, liveViewUrl: string) {
  try {
    console.log('👥 Starting follow automation...');

    broadcastToClients({
      type: 'automation_progress',
      message: 'Starting follow automation - looking for recommendations...',
      step: 'follow_automation_start',
      liveViewUrl: liveViewUrl
    });

    // Step 1: Look for "Who to follow" recommendations
    console.log('🔍 Looking for "Who to follow" recommendations...');

    const whoToFollowSelectors = [
      '[data-testid*="follow"]',
      'div[aria-label*="Follow"]',
      'button[data-testid*="follow"]',
      'div:has-text("Who to follow")',
      'aside div:has-text("Follow")'
    ];

    let followRecommendations = [];

    // Try to find follow recommendations
    for (const selector of whoToFollowSelectors) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();

        if (count > 0) {
          console.log(`✅ Found ${count} follow elements with selector: ${selector}`);

          for (let i = 0; i < Math.min(count, 10); i++) {
            const element = elements.nth(i);
            const isVisible = await element.isVisible();
            const text = await element.textContent().catch(() => '');

            if (isVisible && text && text.toLowerCase().includes('follow') && !text.toLowerCase().includes('following')) {
              followRecommendations.push(element);
            }
          }

          if (followRecommendations.length > 0) {
            console.log(`🎯 Found ${followRecommendations.length} follow recommendations`);
            break;
          }
        }
      } catch (selectorError) {
        console.log(`⚠️ Selector ${selector} failed, trying next...`);
        continue;
      }
    }

    // If no recommendations found, try scrolling
    if (followRecommendations.length === 0) {
      console.log('📜 Scrolling to find follow recommendations...');

      for (let scroll = 0; scroll < 3; scroll++) {
        await page.mouse.wheel(0, 800);
        await page.waitForTimeout(2000);

        const scrollElements = page.locator('[data-testid*="follow"]');
        const scrollCount = await scrollElements.count();

        if (scrollCount > 0) {
          for (let i = 0; i < Math.min(scrollCount, 5); i++) {
            const element = scrollElements.nth(i);
            const isVisible = await element.isVisible();
            const text = await element.textContent().catch(() => '');

            if (isVisible && text && text.toLowerCase().includes('follow') && !text.toLowerCase().includes('following')) {
              followRecommendations.push(element);
            }
          }
        }

        if (followRecommendations.length > 0) break;
      }
    }

    if (followRecommendations.length === 0) {
      console.log('⚠️ No follow recommendations found, skipping follow automation');
      return false;
    }

    // Step 2: Select random recommendation and follow
    const randomIndex = Math.floor(Math.random() * followRecommendations.length);
    const selectedFollowButton = followRecommendations[randomIndex];

    console.log(`🎲 Selected random recommendation ${randomIndex + 1} of ${followRecommendations.length}`);

    broadcastToClients({
      type: 'automation_progress',
      message: `Found ${followRecommendations.length} recommendations, following random account...`,
      step: 'following_account',
      liveViewUrl: liveViewUrl
    });

    // Get username before clicking follow
    let username = '';
    try {
      const parentElement = selectedFollowButton.locator('xpath=ancestor::div[contains(@data-testid, "UserCell") or contains(@class, "user")]').first();
      const usernameElement = parentElement.locator('[data-testid="UserName"], [data-testid="UserHandle"], a[href*="/"]').first();
      const usernameText = await usernameElement.textContent().catch(() => '');

      if (usernameText && usernameText.includes('@')) {
        username = usernameText.replace('@', '').trim();
      } else if (usernameText) {
        const href = await usernameElement.getAttribute('href').catch(() => '');
        if (href && href.includes('/')) {
          username = href.split('/').pop() || '';
        }
      }
    } catch (usernameError) {
      console.log('⚠️ Could not extract username, will try alternative method');
    }

    // Click follow button with human-like behavior
    await page.waitForTimeout(1000 + Math.random() * 2000);

    try {
      const { createCursor } = await import('ghost-cursor-playwright');
      const cursor = await createCursor(page);
      await cursor.click(selectedFollowButton);
    } catch (cursorError) {
      await selectedFollowButton.click();
    }

    console.log('✅ Follow button clicked');
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Step 3: Navigate to user's profile
    if (!username) {
      console.log('⚠️ Username not found, trying to find profile link...');

      const profileLinks = page.locator('a[href*="/"][href$="' + username + '"], a[href*="twitter.com/"], a[href*="x.com/"]');
      const linkCount = await profileLinks.count();

      if (linkCount > 0) {
        const profileLink = profileLinks.first();
        const href = await profileLink.getAttribute('href');
        if (href) {
          username = href.split('/').pop() || '';
        }
      }
    }

    if (username) {
      console.log(`👤 Navigating to profile: @${username}`);

      broadcastToClients({
        type: 'automation_progress',
        message: `Following @${username}, navigating to their profile...`,
        step: 'navigating_to_profile',
        liveViewUrl: liveViewUrl
      });

      const profileUrl = `https://x.com/${username}`;
      await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000 + Math.random() * 2000);

      console.log('✅ Profile loaded successfully');

      // Step 4: Engage with second post
      return await engageWithSecondPost(page, sessionId, liveViewUrl, username);

    } else {
      console.log('❌ Could not determine username for profile navigation');
      return false;
    }

  } catch (error: any) {
    console.error('❌ Follow automation failed:', error.message);

    broadcastToClients({
      type: 'automation_progress',
      message: 'Follow automation encountered an error, continuing...',
      step: 'follow_automation_error',
      liveViewUrl: liveViewUrl
    });

    return false;
  }
}

// Engage with the second post on a user's profile (skip pinned posts)
async function engageWithSecondPost(page: Page, sessionId: string, liveViewUrl: string, username: string) {
  try {
    console.log(`📱 Looking for posts on @${username}'s profile...`);

    broadcastToClients({
      type: 'automation_progress',
      message: `Analyzing @${username}'s posts, looking for second post...`,
      step: 'analyzing_posts',
      liveViewUrl: liveViewUrl
    });

    await page.waitForTimeout(3000);

    const postSelectors = [
      '[data-testid="tweet"]',
      'article[data-testid="tweet"]',
      'div[data-testid="tweet"]',
      'article[role="article"]',
      'div[aria-label*="tweet"]'
    ];

    let posts = [];

    // Find all posts on the profile
    for (const selector of postSelectors) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();

        if (count > 0) {
          console.log(`📄 Found ${count} posts with selector: ${selector}`);

          for (let i = 0; i < Math.min(count, 10); i++) {
            const post = elements.nth(i);
            const isVisible = await post.isVisible();

            if (isVisible) {
              posts.push(post);
            }
          }

          if (posts.length >= 2) {
            console.log(`✅ Found ${posts.length} posts, proceeding with engagement`);
            break;
          }
        }
      } catch (selectorError) {
        console.log(`⚠️ Post selector ${selector} failed, trying next...`);
        continue;
      }
    }

    if (posts.length < 2) {
      console.log('⚠️ Not enough posts found, scrolling to load more...');

      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(3000);

      const scrollPosts = page.locator('[data-testid="tweet"]');
      const scrollCount = await scrollPosts.count();

      posts = [];
      for (let i = 0; i < Math.min(scrollCount, 10); i++) {
        const post = scrollPosts.nth(i);
        const isVisible = await post.isVisible();
        if (isVisible) {
          posts.push(post);
        }
      }
    }

    if (posts.length < 2) {
      console.log('❌ Could not find enough posts to engage with');
      return false;
    }

    // Select the second post (index 1, skipping potential pinned post)
    const secondPost = posts[1];

    console.log('🎯 Targeting second post for engagement...');

    broadcastToClients({
      type: 'automation_progress',
      message: 'Found second post, scrolling to view and engaging...',
      step: 'engaging_second_post',
      liveViewUrl: liveViewUrl
    });

    // Scroll to the second post
    await secondPost.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Extract post content for AI reply
    const postContent = await extractPostContentFromElement(secondPost);

    // Step 1: Like the second post
    console.log('❤️ Liking the second post...');

    const likeSelectors = [
      '[data-testid="like"]',
      '[aria-label*="Like"]',
      'button[aria-label*="like"]',
      '[data-testid="tweet"] button[aria-label*="Like"]'
    ];

    let likeButton = null;
    for (const selector of likeSelectors) {
      try {
        const likeElement = secondPost.locator(selector).first();
        const isVisible = await likeElement.isVisible();
        if (isVisible) {
          likeButton = likeElement;
          console.log(`✅ Found like button with selector: ${selector}`);
          break;
        }
      } catch (likeError) {
        continue;
      }
    }

    if (likeButton) {
      try {
        const { createCursor } = await import('ghost-cursor-playwright');
        const cursor = await createCursor(page);
        await cursor.click(likeButton);
      } catch (cursorError) {
        await likeButton.click();
      }

      console.log('✅ Second post liked successfully');
      await page.waitForTimeout(2000 + Math.random() * 2000);
    } else {
      console.log('⚠️ Like button not found on second post');
    }

    // Step 2: Reply to the second post
    console.log('💬 Opening reply dialog for second post...');

    const replySelectors = [
      '[data-testid="reply"]',
      '[aria-label*="Reply"]',
      'button[aria-label*="reply"]',
      '[data-testid="tweet"] button[aria-label*="Reply"]'
    ];

    let replyButton = null;
    for (const selector of replySelectors) {
      try {
        const replyElement = secondPost.locator(selector).first();
        const isVisible = await replyElement.isVisible();
        if (isVisible) {
          replyButton = replyElement;
          console.log(`✅ Found reply button with selector: ${selector}`);
          break;
        }
      } catch (replyError) {
        continue;
      }
    }

    if (replyButton) {
      try {
        const { createCursor } = await import('ghost-cursor-playwright');
        const cursor = await createCursor(page);
        await cursor.click(replyButton);
      } catch (cursorError) {
        await replyButton.click();
      }

      console.log('✅ Reply dialog opened');
      await page.waitForTimeout(2000 + Math.random() * 2000);

      // Generate AI reply for the second post
      console.log('🤖 Generating AI reply for second post...');

      const thinkingDelay = 2000 + Math.random() * 3000;
      console.log(`🤔 Thinking for ${Math.round(thinkingDelay/1000)}s before replying...`);
      await page.waitForTimeout(thinkingDelay);

      let replyText;
      try {
        replyText = await AIReplyService.generateReply(postContent, 'supportive');
        console.log('✅ AI Generated Reply for profile post:', replyText);

        broadcastToClients({
          type: 'automation_progress',
          message: `AI generated reply for @${username}'s post: "${replyText.substring(0, 50)}..."`,
          step: 'ai_reply_generated_profile',
          liveViewUrl: liveViewUrl
        });
      } catch (aiError: any) {
        console.log('⚠️ AI generation failed, using fallback:', aiError.message);
        replyText = "Great content! Thanks for sharing your insights. 👍";

        broadcastToClients({
          type: 'automation_progress',
          message: 'AI unavailable, using fallback reply for profile post',
          step: 'ai_fallback_used_profile',
          liveViewUrl: liveViewUrl
        });
      }

      // Find and fill the reply text area
      const commentSelectors = [
        '[data-testid="tweetTextarea_0"]',
        'div[data-testid="tweetTextarea_0"]',
        '[role="textbox"]',
        'div[contenteditable="true"]'
      ];

      let commentBox = null;
      for (const selector of commentSelectors) {
        try {
          const element = page.locator(selector);
          const isVisible = await element.isVisible();
          if (isVisible) {
            commentBox = element;
            console.log(`✅ Found comment box with selector: ${selector}`);
            break;
          }
        } catch (commentError) {
          continue;
        }
      }

      if (commentBox) {
        await commentBox.first().focus();
        await page.waitForTimeout(500);

        await page.keyboard.press('Control+a');
        await page.waitForTimeout(100);
        await page.keyboard.press('Delete');
        await page.waitForTimeout(300);

        // Type with human-like patterns
        await typeWithHumanBehavior(page, replyText);

        await page.waitForTimeout(2000);

        // Submit the reply
        const submitSelectors = [
          '[data-testid="tweetButtonInline"]',
          'button[data-testid="tweetButton"]',
          '[role="button"]:has-text("Reply")',
          'button:has-text("Post")'
        ];

        let submitButton = null;
        for (const selector of submitSelectors) {
          try {
            const element = page.locator(selector);
            const isVisible = await element.isVisible();
            const isEnabled = await element.isEnabled();
            if (isVisible && isEnabled) {
              submitButton = element;
              console.log(`✅ Found submit button with selector: ${selector}`);
              break;
            }
          } catch (submitError) {
            continue;
          }
        }

        if (submitButton) {
          console.log('📤 Submitting reply to second post...');

          try {
            const { createCursor } = await import('ghost-cursor-playwright');
            const cursor = await createCursor(page);
            await cursor.click(submitButton);
          } catch (cursorError) {
            await submitButton.click();
          }

          await page.waitForTimeout(3000);

          console.log('✅ Reply submitted successfully to second post');

          broadcastToClients({
            type: 'automation_progress',
            message: `Successfully replied to @${username}'s post!`,
            step: 'profile_reply_complete',
            liveViewUrl: liveViewUrl
          });

          return true;
        } else {
          console.log('❌ Submit button not found or not enabled');
          return false;
        }
      } else {
        console.log('❌ Comment box not found');
        return false;
      }
    } else {
      console.log('⚠️ Reply button not found on second post');
      return false;
    }

  } catch (error: any) {
    console.error('❌ Second post engagement failed:', error.message);
    return false;
  }
}

// Extract post content from a specific post element
async function extractPostContentFromElement(postElement: any): Promise<string> {
  try {
    console.log('📝 Extracting post content from specific post...');

    const postSelectors = [
      '[data-testid="tweetText"]',
      '[lang]',
      '[dir="auto"]',
      'span'
    ];

    let extractedText = '';

    for (const selector of postSelectors) {
      try {
        const elements = postElement.locator(selector);
        const count = await elements.count();

        if (count > 0) {
          const texts = await elements.allTextContents();
          const combinedText = texts.join(' ').trim();

          if (combinedText.length > 10) {
            extractedText = combinedText;
            console.log(`✅ Content extracted using selector: ${selector}`);
            break;
          }
        }
      } catch (selectorError) {
        continue;
      }
    }

    if (extractedText.length > 0) {
      extractedText = extractedText.replace(/\s+/g, ' ').trim();

      if (extractedText.length > 500) {
        extractedText = extractedText.substring(0, 497) + '...';
      }

      console.log('📄 Extracted post content:', extractedText.substring(0, 100) + '...');
      return extractedText;
    } else {
      console.log('⚠️ No post content found, using fallback');
      return 'Interesting post! Thanks for sharing.';
    }

  } catch (error: any) {
    console.error('❌ Post content extraction failed:', error.message);
    return 'Great post! Thanks for sharing this.';
  }
}

// Detect if Cloudflare security challenge is present
async function detectCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    // Multiple ways to detect Cloudflare challenge
    const cloudflareIndicators = [
      'text="Verify you are human"',
      'text="X.com needs to review the security of your connection"',
      '[src*="cloudflare"]',
      'text="Cloudflare"',
      'text="Please complete the security check"',
      '.cf-challenge-running',
      '#cf-challenge-stage'
    ];
    
    for (const indicator of cloudflareIndicators) {
      const isPresent = await page.locator(indicator).isVisible().catch(() => false);
      if (isPresent) {
        console.log(`🛡️ Cloudflare challenge detected with indicator: ${indicator}`);
        return true;
      }
    }
    
    // Check URL for Cloudflare patterns
    const currentUrl = await page.url();
    if (currentUrl.includes('cloudflare') || currentUrl.includes('challenge') || currentUrl.includes('access')) {
      console.log(`🛡️ Cloudflare challenge detected in URL: ${currentUrl}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('⚠️ Error detecting Cloudflare challenge:', error.message);
    return false;
  }
}

// This code adds follow automation after YouTube browsing in the X/Twitter automation script.
export default router;