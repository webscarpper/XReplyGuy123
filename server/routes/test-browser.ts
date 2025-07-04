import { Router } from "express";
import { z } from "zod";
import WebSocket from "ws";
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { Page, Browser, BrowserContext } from "playwright-core";
import { AIReplyService } from "../services/aiService";
import { db } from "../db";
import { browserSessions } from "../../shared/schema";
import { eq } from "drizzle-orm";

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

// Automation state management
let isAutomationPaused = false;
let automationState = {
  replies: 0,
  likes: 0,
  follows: 0,
  targetReplies: 100,
  targetLikes: 100,
  targetFollows: 100,
  sessionStartTime: 0,
  currentPhase: "idle",
  energyLevel: 100,
  focusLevel: 100,
};

// Request schemas
const navigateSchema = z.object({
  url: z.string().url(),
});

const controlSchema = z.object({
  type: z.enum(["click", "type", "scroll", "key"]),
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
  deltaY: z.number().optional(),
  key: z.string().optional(),
});

const automationSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// WebSocket handler for browser control
export function handleBrowserWebSocket(ws: WebSocket) {
  console.log("Browser control WebSocket connected");
  streamingSockets.add(ws);

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "browser_control" && currentPage) {
        const { action } = data;

        switch (action.type) {
          case "click":
            await currentPage.mouse.click(action.x, action.y);
            console.log(`Browser click at ${action.x}, ${action.y}`);
            break;

          case "type":
            await currentPage.keyboard.type(action.text);
            console.log(`Browser type: ${action.text}`);
            break;

          case "scroll":
            await currentPage.mouse.wheel(0, action.deltaY);
            console.log(`Browser scroll: ${action.deltaY}`);
            break;

          case "key":
            await currentPage.keyboard.press(action.key);
            console.log(`Browser key: ${action.key}`);
            break;
        }
      }
    } catch (error: any) {
      console.error("WebSocket message handling error:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          message: error.message,
        }),
      );
    }
  });

  ws.on("close", () => {
    console.log("Browser control WebSocket disconnected");
    streamingSockets.delete(ws);
  });
}

// Helper function to broadcast messages to WebSocket clients
function broadcastToClients(message: any) {
  streamingSockets.forEach((ws) => {
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

  // Properly terminate Browserbase session
  if (currentSession) {
    try {
      console.log("Terminating Browserbase session:", currentSession.id);
      await browserbase.sessions.update(currentSession.id, {
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        status: "REQUEST_RELEASE" as any,
      });
      console.log("Browserbase session terminated successfully");
    } catch (e) {
      console.log("Browserbase session termination error:", e);
    }
    currentSession = null;
  }

  isConnected = false;

  // Notify all connected clients
  streamingSockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "session_closed",
          message: "Browser session has been terminated",
        }),
      );
    }
  });
}

// Cookie management functions
async function saveCookiesToDatabase(sessionId: string, page: Page) {
  try {
    console.log("💾 Saving cookies to database...");

    const cookies = await page.context().cookies();

    // Enhanced cookie filtering - only X/Twitter related and non-expired
    const xCookies = cookies.filter(
      (cookie) => {
        const isXDomain = cookie.domain.includes("x.com") ||
          cookie.domain.includes("twitter.com") ||
          cookie.domain.includes(".x.com") ||
          cookie.domain.includes(".twitter.com");
        
        const isNotExpired = !cookie.expires || new Date(cookie.expires * 1000) > new Date();
        
        return isXDomain && isNotExpired;
      }
    );

    if (xCookies.length === 0) {
      console.log("⚠️ No X/Twitter cookies found to save");
      return false;
    }

    const cookiesJson = JSON.stringify(xCookies);

    // Update the browserSessions record with cookies
    await db
      .update(browserSessions)
      .set({
        cookies: cookiesJson,
      })
      .where(eq(browserSessions.sessionId, sessionId));

    console.log(`✅ Saved ${xCookies.length} X/Twitter cookies to database`);
    return true;
  } catch (error: any) {
    console.error("❌ Failed to save cookies:", error.message);
    return false;
  }
}

async function loadCookiesFromDatabase(sessionId: string, page: Page) {
  try {
    console.log("🔄 Loading cookies from database...");

    const sessionRecord = await db
      .select()
      .from(browserSessions)
      .where(eq(browserSessions.sessionId, sessionId))
      .limit(1);

    if (sessionRecord.length === 0 || !sessionRecord[0].cookies) {
      console.log("⚠️ No saved cookies found in database");
      return false;
    }

    const cookies = JSON.parse(sessionRecord[0].cookies);

    if (!Array.isArray(cookies) || cookies.length === 0) {
      console.log("⚠️ Invalid or empty cookies data");
      return false;
    }

    // Validate and filter cookies before loading
    const validCookies = cookies.filter((cookie: any) => {
      // Check if cookie has required properties
      if (!cookie.name || !cookie.value || !cookie.domain) {
        return false;
      }
      
      // Check if cookie is not expired
      const isNotExpired = !cookie.expires || new Date(cookie.expires * 1000) > new Date();
      
      const isXDomain = cookie.domain.includes("x.com") ||
        cookie.domain.includes("twitter.com") ||
        cookie.domain.includes(".x.com") ||
        cookie.domain.includes(".twitter.com");
      
      return isNotExpired && isXDomain;
    });

    if (validCookies.length === 0) {
      console.log("⚠️ No valid cookies found after validation");
      return false;
    }

    // Add validated cookies to the browser context
    await page.context().addCookies(validCookies);
    
    console.log(`✅ Loaded ${validCookies.length} valid cookies (filtered from ${cookies.length} total)`);
    return true;

    console.log(`✅ Loaded ${cookies.length} cookies from database`);
    return true;
  } catch (error: any) {
    console.error("❌ Failed to load cookies:", error.message);
    return false;
  }
}

async function validateCookies(page: Page) {
  try {
    console.log("🔍 Validating cookies...");

    // Navigate to X home page to test cookies
    await page.goto("https://x.com/home", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Check if we're logged in by looking for authenticated elements
    const isLoggedIn = await checkIfLoggedIn(page);

    if (isLoggedIn) {
      console.log("✅ Cookies are valid - user is logged in");
      return true;
    } else {
      console.log("❌ Cookies are invalid or expired");
      return false;
    }
  } catch (error: any) {
    console.error("❌ Cookie validation failed:", error.message);
    return false;
  }
}

async function checkIfLoggedIn(page: Page) {
  try {
    // Check for authenticated elements
    const homeButton = await page.$('[data-testid="AppTabBar_Home_Link"]');
    const profileButton = await page.$(
      '[data-testid="AppTabBar_Profile_Link"]',
    );
    const composeButton = await page.$(
      '[data-testid="SideNav_NewTweet_Button"]',
    );

    // Check URL
    const currentUrl = await page.url();
    const isAuthenticatedUrl =
      currentUrl.includes("/home") ||
      currentUrl.includes("/following") ||
      (currentUrl.includes("x.com") && !currentUrl.includes("/login"));

    return (
      !!(homeButton || profileButton || composeButton) && isAuthenticatedUrl
    );
  } catch (error) {
    return false;
  }
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
      status: isConnected ? "connected" : "disconnected",
      automationState: {
        ...automationState,
        isPaused: isAutomationPaused,
      },
    });
  } catch (error: any) {
    console.error("Status check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get browser status",
      error: error.message,
      status: "error",
    });
  }
});

// Test connection to Browserbase with enhanced stealth
router.post("/test-connection", async (req, res) => {
  try {
    console.log("Testing Browserbase connection with Pro plan features...");

    // Cleanup existing session
    await cleanupSession();

    // Create new Browserbase session with Developer plan settings
    console.log("Creating new Browserbase session with Developer plan settings...");
    // Generate realistic viewport dimensions
    const viewportWidths = [1366, 1920, 1440, 1536, 1280];
    const viewportHeights = [768, 1080, 900, 864, 720];
    const randomWidth = viewportWidths[Math.floor(Math.random() * viewportWidths.length)] + Math.floor(Math.random() * 100);
    const randomHeight = viewportHeights[Math.floor(Math.random() * viewportHeights.length)] + Math.floor(Math.random() * 100);
    
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    ];
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    const isMobile = Math.random() < 0.2;
    
    const sessionConfig = {
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        solveCaptchas: false, // Manual solving preferred for user control
        viewport: {
          width: isMobile ? 375 + Math.floor(Math.random() * 50) : randomWidth, // Mobile: 375-425, Desktop: varied
          height: isMobile ? 667 + Math.floor(Math.random() * 100) : randomHeight, // Mobile: 667-767, Desktop: varied
        },
        ...(isMobile ? {
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        } : {}),
      },
      proxies: true, // Essential for Cloudflare evasion
      timeout: 3600, // 1 hour in seconds for Developer plan
    };
    
    console.log("🚫 CAPTCHA auto-solving DISABLED - manual solving required");
    console.log("Session config:", JSON.stringify(sessionConfig, null, 2));
    
    currentSession = await browserbase.sessions.create(sessionConfig as any);

    console.log(`Browserbase session created: ${currentSession.id}`);

    // Connect using Playwright CDP
    console.log("Connecting to session via CDP...");
    currentBrowser = await chromium.connectOverCDP(currentSession.connectUrl);
    currentContext = currentBrowser.contexts()[0];
    currentPage = currentContext.pages()[0];

    await applyStealthModifications(currentPage);
    await handleCorsErrors(currentPage);

    // Set session timeout for 6 hours
    sessionTimeout = setTimeout(async () => {
      console.log("Session timeout reached, cleaning up...");
      await cleanupSession();
    }, 21600000); // 6 hours

    console.log("Connected to Browserbase session successfully");
    isConnected = true;
    
    // Clean session - no automatic cookie operations
    console.log("🧹 Clean session established - no automatic cookie loading");
    console.log("👤 Manual control mode - user handles all authentication");

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
      captchaSolving: false, // Manual CAPTCHA solving - automatic solving disabled
      proxyEnabled: true,
      timeout: "1 hour",
      status: "connected",
    });
  } catch (error: any) {
    console.error("Browserbase connection error:", error);
    await cleanupSession();

    res.status(500).json({
      success: false,
      message: "Failed to connect to Browserbase",
      error: error.message,
      status: "disconnected",
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
        message: "No active browser session. Please test connection first.",
      });
    }

    console.log("Navigating to:", url);

    // Clean navigation for X.com - no automatic operations
    if (url.includes('x.com') || url.includes('twitter.com')) {
      console.log("🌐 Navigating to X/Twitter (clean mode - no automation)...");
      
      // Simple, clean navigation - let user handle everything manually
      await currentPage.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      
      console.log("✅ X.com loaded - ready for manual interaction");
      console.log("🚫 No automatic cookie loading or CAPTCHA solving");
      
    } else {
      // Standard navigation for other sites
      await currentPage.goto(url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const currentUrl = await currentPage.url();
    const title = await currentPage.title();

    console.log("Navigation successful:", currentUrl);

    res.json({
      success: true,
      message: "Navigation successful",
      currentUrl,
      title,
      status: "navigated",
    });
  } catch (error: any) {
    console.error("Navigation error:", error);
    res.status(500).json({
      success: false,
      message: "Navigation failed",
      error: error.message,
      status: "error",
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
        message: "No active browser session. Please test connection first.",
      });
    }

    switch (action.type) {
      case "click":
        if (action.x !== undefined && action.y !== undefined) {
          await currentPage.mouse.click(action.x, action.y);
          console.log(`Manual click at ${action.x}, ${action.y}`);
        }
        break;

      case "type":
        if (action.text) {
          await currentPage.keyboard.type(action.text);
          console.log(`Manual type: ${action.text}`);
        }
        break;

      case "scroll":
        if (action.deltaY !== undefined) {
          await currentPage.mouse.wheel(0, action.deltaY);
          console.log(`Manual scroll: ${action.deltaY}`);
        }
        break;

      case "key":
        if (action.key) {
          await currentPage.keyboard.press(action.key);
          console.log(`Manual key: ${action.key}`);
        }
        break;
    }

    res.json({
      success: true,
      message: `${action.type} action executed`,
      action,
    });
  } catch (error: any) {
    console.error("Control action error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute control action",
      error: error.message,
    });
  }
});

// Take screenshot
router.get("/screenshot", async (req, res) => {
  try {
    if (!currentPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first.",
      });
    }

    console.log("Taking screenshot...");

    const screenshot = await currentPage.screenshot({
      fullPage: false,
      type: "png",
    });

    const currentUrl = await currentPage.url();
    const title = await currentPage.title();

    res.json({
      success: true,
      screenshot: `data:image/png;base64,${screenshot.toString("base64")}`,
      currentUrl,
      title,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Screenshot error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to take screenshot",
      error: error.message,
    });
  }
});

// Start live streaming (using Browserbase debug URL)
router.post("/start-streaming", async (req, res) => {
  try {
    if (!currentSession || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first.",
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
        details: "Debug URL not available for this session",
      });
    }

    if (!liveViewUrl) {
      return res.status(500).json({
        success: false,
        message: "Live view URL not available",
        details: "Session may not be ready for debugging",
      });
    }

    // Broadcast live view URL to all connected WebSocket clients
    streamingSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "live_view_url",
            url: liveViewUrl,
            message: "Browserbase live view ready for iframe embedding",
            sessionId: currentSession.id,
          }),
        );
      }
    });

    isStreaming = true;
    console.log("Browserbase live view started successfully");

    res.json({
      success: true,
      message: "Live view started",
      liveViewUrl,
      sessionId: currentSession.id,
      status: "streaming",
    });
  } catch (error: any) {
    console.error("Start live view error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start live view",
      error: error.message,
      details: "Ensure Browserbase session is properly initialized",
    });
  }
});

// Stop live streaming
router.post("/stop-streaming", async (req, res) => {
  try {
    if (!isStreaming) {
      return res.json({
        success: true,
        message: "Live view not active",
      });
    }

    console.log("Stopping Browserbase live view...");

    // Notify all connected clients that live view is stopping
    streamingSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "live_view_stopped",
            message: "Live view has been stopped",
          }),
        );
      }
    });

    isStreaming = false;
    console.log("Browserbase live view stopped");

    res.json({
      success: true,
      message: "Live view stopped",
      status: "stopped",
    });
  } catch (error: any) {
    console.error("Stop live view error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop live view",
      error: error.message,
    });
  }
});

// Pause automation
router.post("/pause-automation", async (req, res) => {
  try {
    isAutomationPaused = true;

    // Save current state to database if we have an active session
    if (testSession) {
      await saveCookiesToDatabase(testSession.id, testPage!);
    }

    broadcastToClients({
      type: "automation_paused",
      message: "Automation paused by user",
      automationState: {
        ...automationState,
        isPaused: true,
      },
    });

    res.json({
      success: true,
      message: "Automation paused successfully",
      automationState: {
        ...automationState,
        isPaused: true,
      },
    });
  } catch (error: any) {
    console.error("Pause automation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to pause automation",
      error: error.message,
    });
  }
});

// Resume automation
router.post("/resume-automation", async (req, res) => {
  try {
    isAutomationPaused = false;

    broadcastToClients({
      type: "automation_resumed",
      message: "Automation resumed by user",
      automationState: {
        ...automationState,
        isPaused: false,
      },
    });

    res.json({
      success: true,
      message: "Automation resumed successfully",
      automationState: {
        ...automationState,
        isPaused: false,
      },
    });
  } catch (error: any) {
    console.error("Resume automation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resume automation",
      error: error.message,
    });
  }
});

// Reconnect to existing session with cookies
router.post("/reconnect-session", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    console.log(`🔄 Reconnecting to session: ${sessionId}`);

    // Generate realistic viewport dimensions for reconnection
    const viewportWidths = [1366, 1920, 1440, 1536, 1280];
    const viewportHeights = [768, 1080, 900, 864, 720];
    const randomWidth = viewportWidths[Math.floor(Math.random() * viewportWidths.length)] + Math.floor(Math.random() * 100);
    const randomHeight = viewportHeights[Math.floor(Math.random() * viewportHeights.length)] + Math.floor(Math.random() * 100);
    
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    ];
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    const isMobile = Math.random() < 0.15;
    
    // Create new browser session with Enhanced Stealth Mode
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        solveCaptchas: false, // Manual solving preferred for user control
        viewport: {
          width: isMobile ? 375 + Math.floor(Math.random() * 50) : randomWidth,
          height: isMobile ? 667 + Math.floor(Math.random() * 100) : randomHeight,
        },
        ...(isMobile ? {
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        } : {}),
      },
      proxies: true, // Essential for Cloudflare evasion
      timeout: 21600,
      keepAlive: true,
    });

    const browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    // Load cookies from database
    const cookiesLoaded = await loadCookiesFromDatabase(sessionId, page);

    if (cookiesLoaded) {
      // Validate cookies
      const cookiesValid = await validateCookies(page);

      if (cookiesValid) {
        // Store session globally
        testSession = session;
        testBrowser = browser;
        testContext = context;
        testPage = page;

        const liveViewLinks = await browserbase.sessions.debug(session.id);
        const liveViewUrl = liveViewLinks.debuggerFullscreenUrl;

        res.json({
          success: true,
          message: "Successfully reconnected with saved cookies",
          sessionId: session.id,
          liveViewUrl: liveViewUrl,
          cookiesLoaded: true,
          cookiesValid: true,
        });
      } else {
        res.json({
          success: false,
          message:
            "Saved cookies are invalid or expired. Manual login required.",
          sessionId: session.id,
          cookiesLoaded: true,
          cookiesValid: false,
        });
      }
    } else {
      res.json({
        success: false,
        message: "No saved cookies found. Manual login required.",
        sessionId: session.id,
        cookiesLoaded: false,
        cookiesValid: false,
      });
    }
  } catch (error: any) {
    console.error("Reconnect session error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reconnect session",
      error: error.message,
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
        await browserbase.sessions.update(testSession.id, {
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          status: "REQUEST_RELEASE" as any,
        });
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
      status: "closed",
    });
  } catch (error: any) {
    console.error("Session termination error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to terminate browser session",
      error: error.message,
    });
  }
});

// Enhanced Test Script - Starts automation from authenticated state
router.post("/test-script", async (req, res) => {
  try {
    console.log("🚀 Starting enhanced automation from authenticated state...");

    // Reset automation state
    automationState = {
      replies: 0,
      likes: 0,
      follows: 0,
      targetReplies: 100,
      targetLikes: 100,
      targetFollows: 100,
      sessionStartTime: Date.now(),
      currentPhase: "starting",
      energyLevel: 100,
      focusLevel: 100,
    };
    isAutomationPaused = false;

    // Generate realistic viewport dimensions for automation
    const viewportWidths = [1366, 1920, 1440, 1536, 1280];
    const viewportHeights = [768, 1080, 900, 864, 720];
    const randomWidth = viewportWidths[Math.floor(Math.random() * viewportWidths.length)] + Math.floor(Math.random() * 100);
    const randomHeight = viewportHeights[Math.floor(Math.random() * viewportHeights.length)] + Math.floor(Math.random() * 100);
    
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
    ];
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    const isMobile = Math.random() < 0.1;
    
    // 1. Create Browserbase session with Comprehensive Advanced Stealth Mode
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        solveCaptchas: false, // Manual solving preferred for user control
        viewport: {
          width: isMobile ? 375 + Math.floor(Math.random() * 50) : randomWidth,
          height: isMobile ? 667 + Math.floor(Math.random() * 100) : randomHeight,
        },
        ...(isMobile ? {
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        } : {}),
      },
      proxies: true, // Essential for Cloudflare evasion
      timeout: 21600, // 6 hours
      keepAlive: true,
    });

    console.log("✅ Session created:", session.id);

    // 2. Connect to browser
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0];

    await applyStealthModifications(page);
    await handleCorsErrors(page);

    // 3. Initialize ghost cursor
    console.log("🎯 Initializing ghost cursor...");
    let cursor;

    try {
      const { createCursor } = await import("ghost-cursor-playwright");
      cursor = await createCursor(page);

      if (cursor && (cursor as any).click) {
        console.log("✅ Ghost cursor initialized successfully");
      } else {
        throw new Error("Ghost cursor object invalid");
      }
    } catch (error) {
      console.log("⚠️ Ghost cursor failed, creating fallback:", (error as Error).message);

      cursor = {
        click: async (element: any) => {
          await element.click();
        },
      };
    }

    // Store session globally
    testSession = session;
    testBrowser = browser;
    testContext = defaultContext;
    testPage = page;

    // 4. Get live view URL
    const liveViewLinks = await browserbase.sessions.debug(session.id);
    const liveViewUrl = liveViewLinks.debuggerFullscreenUrl;

    // 5. Broadcast live view URL
    broadcastToClients({
      type: "live_view_url",
      url: liveViewUrl,
      message:
        "Live view ready - please login manually and navigate to X home page",
      sessionId: session.id,
    });

    // 6. Navigate to X login page
    await page.goto("https://x.com/i/flow/login", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // 7. Check if already logged in (from cookies)
    const alreadyLoggedIn = await checkIfLoggedIn(page);

    if (alreadyLoggedIn) {
      console.log("✅ Already logged in via cookies");

      broadcastToClients({
        type: "automation_progress",
        message: "Already logged in! Starting automation immediately...",
        step: "already_logged_in",
        liveViewUrl: liveViewUrl,
      });

      res.json({
        success: true,
        status: "continuing_automation",
        liveViewUrl: liveViewUrl,
        message: "Already logged in, starting automation",
        sessionId: session.id,
      });

      // Start automation immediately
      await performEnhancedAutomation(page, session.id, liveViewUrl, cursor);
    } else {
      console.log("🔐 Manual login required");

      broadcastToClients({
        type: "automation_progress",
        message:
          "Please complete login manually and navigate to X home page. Automation will start when ready.",
        step: "manual_login_required",
        liveViewUrl: liveViewUrl,
        sessionId: session.id,
      });

      res.json({
        success: true,
        status: "manual_login_required",
        liveViewUrl: liveViewUrl,
        message:
          "Please complete login manually in the browser above, then automation will start automatically",
        sessionId: session.id,
      });

      // Wait for manual login and start automation
      waitForManualLoginAndStart(page, session.id, liveViewUrl, cursor);
    }
  } catch (error: any) {
    console.error("❌ Test script error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Wait for manual login and start automation
async function waitForManualLoginAndStart(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
  cursor: any,
) {
  try {
    console.log("⏳ Waiting for manual login completion...");

    const maxWait = 900000; // 15 minutes for manual login (increased from 10)
    const checkInterval = 3000; // 3 seconds (more frequent checks)
    let elapsed = 0;

    while (elapsed < maxWait && !isAutomationPaused) {
      try {
        const currentUrl = await page.url();
        const isLoggedIn = await checkIfLoggedIn(page);

        if (
          isLoggedIn &&
          (currentUrl.includes("/home") || currentUrl.includes("/following"))
        ) {
          console.log(
            "✅ Manual login detected and user is on home/following page!",
          );

          // Save cookies after successful login
          await saveCookiesToDatabase(sessionId, page);

          broadcastToClients({
            type: "automation_progress",
            message: "Login detected! Starting enhanced automation...",
            step: "login_complete_starting_automation",
            liveViewUrl: liveViewUrl,
          });

          // Start the enhanced automation
          await performEnhancedAutomation(page, sessionId, liveViewUrl, cursor);
          return;
        }

        // Check for Cloudflare challenges
        const cloudflareDetected = await detectCloudflareChallenge(page);
        if (cloudflareDetected) {
          broadcastToClients({
            type: "automation_progress",
            message: "Cloudflare challenge detected. Please complete manually.",
            step: "cloudflare_challenge",
            liveViewUrl: liveViewUrl,
          });
        }
      } catch (checkError) {
        console.log("⚠️ Login check error:", (checkError as Error).message);
      }

      await page.waitForTimeout(checkInterval);
      elapsed += checkInterval;

      // Update user every 30 seconds
      if (elapsed % 30000 === 0) {
        const remainingMinutes = Math.round((maxWait - elapsed) / 60000);
        broadcastToClients({
          type: "automation_progress",
          message: `Waiting for manual login (${remainingMinutes} minutes remaining)...`,
          step: "waiting_for_login",
          liveViewUrl: liveViewUrl,
        });
      }
    }

    if (elapsed >= maxWait) {
      broadcastToClients({
        type: "automation_error",
        error: "Manual login timeout - please try again",
        sessionId: sessionId,
        liveViewUrl: liveViewUrl,
      });
    }
  } catch (error: any) {
    console.error("❌ Manual login wait error:", error);
    broadcastToClients({
      type: "automation_error",
      error: error.message,
      sessionId: sessionId,
      liveViewUrl: liveViewUrl,
    });
  }
}

// Enhanced automation with human-like behavior and 6-hour operation
async function performEnhancedAutomation(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
  cursor: any,
) {
  try {
    console.log("🤖 Starting enhanced 6-hour automation cycle...");

    automationState.currentPhase = "running";
    automationState.sessionStartTime = Date.now();

    broadcastToClients({
      type: "automation_progress",
      message:
        "Enhanced automation started! Target: 100 replies, 100 likes, 100 follows over 6 hours",
      step: "automation_started",
      liveViewUrl: liveViewUrl,
      automationState: automationState,
    });

    // Main automation loop - runs for 6 hours or until targets met
    const maxDuration = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxDuration && !isAutomationPaused) {
      try {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime % (5 * 60 * 1000) < 60000) { // Check within first minute of each 5-minute interval
          console.log("🔍 Performing periodic session health check...");
          const isHealthy = await monitorSessionHealth(page, sessionId);
          if (!isHealthy) {
            console.log("🚨 Session health check failed, attempting recovery...");
            
            broadcastToClients({
              type: "automation_progress",
              message: "Session health issue detected. Attempting recovery...",
              step: "session_recovery",
              liveViewUrl: liveViewUrl,
              automationState: automationState,
            });
            
            // Try to navigate back to home
            try {
              await page.goto("https://x.com/home", {
                waitUntil: "networkidle",
                timeout: 30000,
              });
              await page.waitForTimeout(5000);
              
              // Check if recovery was successful
              const recoverySuccessful = await checkIfLoggedIn(page);
              if (!recoverySuccessful) {
                throw new Error("Recovery failed - session may be compromised");
              }
              
              console.log("✅ Recovery successful, continuing automation");
              broadcastToClients({
                type: "automation_progress",
                message: "Session recovery successful. Continuing automation...",
                step: "recovery_complete",
                liveViewUrl: liveViewUrl,
                automationState: automationState,
              });
            } catch (recoveryError: any) {
              console.error("❌ Session recovery failed:", recoveryError.message);
              throw new Error(`Session recovery failed: ${recoveryError.message}`);
            }
          }
        }

        // Check if targets are met
        if (
          automationState.replies >= automationState.targetReplies &&
          automationState.likes >= automationState.targetLikes &&
          automationState.follows >= automationState.targetFollows
        ) {
          console.log("🎉 All targets achieved!");
          broadcastToClients({
            type: "automation_complete",
            message:
              "All targets achieved! Continuing with random activities...",
            sessionId: sessionId,
            liveViewUrl: liveViewUrl,
            automationState: automationState,
          });

          // Continue with random activities even after targets are met
        }

        // Simulate human energy/focus decline over time
        const elapsedHours = (Date.now() - startTime) / (60 * 60 * 1000);
        automationState.energyLevel = Math.max(20, 100 - elapsedHours * 15);
        automationState.focusLevel = Math.max(30, 100 - elapsedHours * 12);

        // Select next action based on current state and human-like behavior
        const nextAction = selectNextAction();

        console.log(
          `🎯 Next action: ${nextAction} (Energy: ${Math.round(automationState.energyLevel)}%, Focus: ${Math.round(automationState.focusLevel)}%)`,
        );

        // Execute the selected action
        await executeAction(page, sessionId, liveViewUrl, cursor, nextAction);

        // Human-like pause between actions (varies based on energy/focus)
        const pauseDuration = calculateHumanPause();
        console.log(
          `⏸️ Human-like pause: ${Math.round(pauseDuration / 1000)}s`,
        );

        broadcastToClients({
          type: "automation_progress",
          message: `Completed ${nextAction}. Pausing ${Math.round(pauseDuration / 1000)}s before next action...`,
          step: "action_complete",
          liveViewUrl: liveViewUrl,
          automationState: automationState,
        });

        await page.waitForTimeout(pauseDuration);

        // Check for pause requests
        if (isAutomationPaused) {
          console.log("⏸️ Automation paused by user");
          await saveCookiesToDatabase(sessionId, page);

          broadcastToClients({
            type: "automation_paused",
            message: "Automation paused by user. Session and progress saved.",
            sessionId: sessionId,
            liveViewUrl: liveViewUrl,
            automationState: automationState,
          });

          // Wait for resume
          while (isAutomationPaused) {
            await page.waitForTimeout(5000);
          }

          console.log("▶️ Automation resumed");
          broadcastToClients({
            type: "automation_resumed",
            message: "Automation resumed. Continuing from where we left off...",
            sessionId: sessionId,
            liveViewUrl: liveViewUrl,
            automationState: automationState,
          });
        }
      } catch (actionError: any) {
        console.error("❌ Action execution error:", actionError.message);

        // Human-like recovery - pause and try to continue
        await page.waitForTimeout(10000 + Math.random() * 10000);

        // Try to navigate back to home if we're lost
        try {
          const currentUrl = await page.url();
          if (!currentUrl.includes("x.com") || currentUrl.includes("/login")) {
            await page.goto("https://x.com/home", {
              waitUntil: "networkidle",
              timeout: 30000,
            });
            await page.waitForTimeout(3000);
          }
        } catch (recoveryError) {
          console.error(
            "❌ Recovery navigation failed:",
            (recoveryError as Error).message,
          );
        }
      }
    }

    // Automation completed (either by time or user stop)
    console.log("🏁 Enhanced automation cycle completed");

    // Save final state
    await saveCookiesToDatabase(sessionId, page);

    const finalStats = {
      duration: Math.round((Date.now() - startTime) / (60 * 1000)), // minutes
      replies: automationState.replies,
      likes: automationState.likes,
      follows: automationState.follows,
      targetsAchieved: {
        replies: automationState.replies >= automationState.targetReplies,
        likes: automationState.likes >= automationState.targetLikes,
        follows: automationState.follows >= automationState.targetFollows,
      },
    };

    broadcastToClients({
      type: "automation_complete",
      message: `Enhanced automation completed! Duration: ${finalStats.duration} minutes`,
      sessionId: sessionId,
      liveViewUrl: liveViewUrl,
      automationState: automationState,
      finalStats: finalStats,
    });
  } catch (error: any) {
    console.error("❌ Enhanced automation error:", error);
    broadcastToClients({
      type: "automation_error",
      error: error.message,
      sessionId: sessionId,
      liveViewUrl: liveViewUrl,
      automationState: automationState,
    });
  }
}

// Select next action based on current state and human behavior patterns
function selectNextAction(): string {
  const actions = [];

  // Weight actions based on targets and current state
  if (automationState.replies < automationState.targetReplies) {
    actions.push("reply", "reply", "reply"); // Higher weight for replies
  }

  if (automationState.likes < automationState.targetLikes) {
    actions.push("like", "like");
  }

  if (automationState.follows < automationState.targetFollows) {
    actions.push("follow");
  }

  // Always include human-like activities with weighted probabilities
  actions.push(
    "browse_notifications",
    "scroll_feed", "scroll_feed", // Higher weight for passive activities
    "read_post", "read_post",
    "youtube_break",
    "profile_browse", "profile_browse",
    "search_behavior",
    "check_trending",
  );

  // Energy/focus affects action selection
  if (automationState.energyLevel < 50) {
    actions.push("scroll_feed", "read_post", "youtube_break"); // More passive activities
  }

  if (automationState.focusLevel < 40) {
    actions.push("youtube_break", "random_browse"); // Distraction activities
  }

  // Random selection with weighted probabilities
  return actions[Math.floor(Math.random() * actions.length)];
}

// Calculate human-like pause duration based on energy/focus
function calculateHumanPause(): number {
  const baseDelay = 12000; // 12 seconds base (reduced from 15)
  const energyFactor = (100 - automationState.energyLevel) / 100;
  const focusFactor = (100 - automationState.focusLevel) / 100;
  
  const hour = new Date().getHours();
  const circadianFactor = (hour >= 1 && hour <= 6) ? 1.5 : 1.0;
  
  // Session duration fatigue (longer pauses as session progresses)
  const sessionDuration = Date.now() - automationState.sessionStartTime;
  const sessionHours = sessionDuration / (60 * 60 * 1000);
  const fatigueFactor = 1 + (sessionHours * 0.1); // 10% increase per hour
  
  const additionalDelay = (energyFactor + focusFactor) * 25000 * circadianFactor * fatigueFactor;
  const randomVariation = Math.random() * 15000; // ±7.5s random
  
  return Math.max(3000, baseDelay + additionalDelay + randomVariation);
}

// Execute specific automation action
async function executeAction(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
  cursor: any,
  action: string,
) {
  try {
    console.log(`🎬 Executing action: ${action}`);

    switch (action) {
      case "reply":
        await performReplyAction(page, sessionId, liveViewUrl, cursor);
        break;
      case "like":
        await performLikeAction(page, sessionId, liveViewUrl, cursor);
        break;
      case "follow":
        await performFollowAction(page, sessionId, liveViewUrl, cursor);
        break;
      case "browse_notifications":
        await browseNotifications(page, sessionId, liveViewUrl, cursor);
        break;
      case "scroll_feed":
        await scrollFeed(page, sessionId, liveViewUrl);
        break;
      case "read_post":
        await readPost(page, sessionId, liveViewUrl);
        break;
      case "youtube_break":
        await takeYouTubeBreak(page, sessionId, liveViewUrl);
        break;
      case "profile_browse":
        await browseRandomProfile(page, sessionId, liveViewUrl, cursor);
        break;
      case "random_browse":
        await performRandomBrowsing(page, sessionId, liveViewUrl);
        break;
      default:
        console.log(`⚠️ Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error(`❌ Action ${action} failed:`, error.message);
    throw error;
  }
}

// Individual action implementations
async function performReplyAction(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
  cursor: any,
) {
  try {
    console.log("💬 Performing reply action...");

    // Navigate to home feed if not already there
    await ensureOnHomeFeed(page);

    // Find posts to reply to
    const posts = await findPosts(page);
    if (posts.length === 0) {
      console.log("⚠️ No posts found for reply");
      return;
    }

    // Select random post
    const randomPost =
      posts[Math.floor(Math.random() * Math.min(posts.length, 5))];

    // Scroll to post and read it
    await randomPost.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000 + Math.random() * 3000);

    // Extract post content
    const postContent = await extractPostContentFromElement(randomPost);

    // Find and click reply button
    const replyButton = randomPost.locator('[data-testid="reply"]').first();
    const isReplyVisible = await replyButton.isVisible();

    if (!isReplyVisible) {
      console.log("⚠️ Reply button not visible");
      return;
    }

    await cursor.click(replyButton);
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Find comment box and generate reply
    const commentBox = page.locator('[data-testid="tweetTextarea_0"]').first();
    const isCommentBoxVisible = await commentBox.isVisible();

    if (!isCommentBoxVisible) {
      console.log("⚠️ Comment box not visible");
      return;
    }

    // Generate AI reply
    let replyText;
    try {
      replyText = await AIReplyService.generateReply(
        postContent,
        "conversational",
      );
      console.log("✅ AI Generated Reply:", replyText);
    } catch (aiError: any) {
      console.log("⚠️ AI generation failed, using fallback:", aiError.message);
      const fallbackReplies = [
        "Interesting perspective! Thanks for sharing this. 👍",
        "Great point! I hadn't thought about it that way.",
        "Thanks for posting this! Really insightful.",
        "This is really helpful, appreciate you sharing!",
        "Love this! Thanks for the great content. 🙌",
      ];
      replyText =
        fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
    }

    // Type reply with human-like behavior
    await commentBox.focus();
    await page.waitForTimeout(500);
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await page.waitForTimeout(300);

    await typeWithHumanBehavior(page, replyText);
    await page.waitForTimeout(2000);

    // Submit reply
    const submitButton = page
      .locator('[data-testid="tweetButtonInline"]')
      .first();
    const isSubmitEnabled = await submitButton.isEnabled();

    if (isSubmitEnabled) {
      await cursor.click(submitButton);
      await page.waitForTimeout(3000);

      automationState.replies++;
      console.log(`✅ Reply posted! Total replies: ${automationState.replies}`);

      broadcastToClients({
        type: "automation_progress",
        message: `Reply posted! Progress: ${automationState.replies}/${automationState.targetReplies} replies`,
        step: "reply_posted",
        liveViewUrl: liveViewUrl,
        automationState: automationState,
      });
    } else {
      console.log("⚠️ Submit button not enabled");
    }
  } catch (error: any) {
    console.error("❌ Reply action failed:", error.message);
    throw error;
  }
}

async function performLikeAction(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
  cursor: any,
) {
  try {
    console.log("❤️ Performing like action...");

    await ensureOnHomeFeed(page);

    const posts = await findPosts(page);
    if (posts.length === 0) {
      console.log("⚠️ No posts found for like");
      return;
    }

    const randomPost =
      posts[Math.floor(Math.random() * Math.min(posts.length, 5))];
    await randomPost.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000 + Math.random() * 2000);

    const likeButton = randomPost.locator('[data-testid="like"]').first();
    const isLikeVisible = await likeButton.isVisible();

    if (isLikeVisible) {
      await cursor.click(likeButton);
      await page.waitForTimeout(1000 + Math.random() * 1000);

      automationState.likes++;
      console.log(`✅ Post liked! Total likes: ${automationState.likes}`);

      broadcastToClients({
        type: "automation_progress",
        message: `Post liked! Progress: ${automationState.likes}/${automationState.targetLikes} likes`,
        step: "post_liked",
        liveViewUrl: liveViewUrl,
        automationState: automationState,
      });
    } else {
      console.log("⚠️ Like button not visible");
    }
  } catch (error: any) {
    console.error("❌ Like action failed:", error.message);
    throw error;
  }
}

async function performFollowAction(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
  cursor: any,
) {
  try {
    console.log("👥 Performing follow action...");

    await ensureOnHomeFeed(page);

    // Look for "Who to follow" recommendations
    const followButtons = page.locator(
      '[data-testid*="follow"]:not([data-testid*="following"])',
    );
    const followCount = await followButtons.count();

    if (followCount > 0) {
      const randomIndex = Math.floor(Math.random() * Math.min(followCount, 5));
      const followButton = followButtons.nth(randomIndex);
      const isVisible = await followButton.isVisible();

      if (isVisible) {
        await followButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000 + Math.random() * 2000);

        await cursor.click(followButton);
        await page.waitForTimeout(2000 + Math.random() * 2000);

        automationState.follows++;
        console.log(
          `✅ Account followed! Total follows: ${automationState.follows}`,
        );

        broadcastToClients({
          type: "automation_progress",
          message: `Account followed! Progress: ${automationState.follows}/${automationState.targetFollows} follows`,
          step: "account_followed",
          liveViewUrl: liveViewUrl,
          automationState: automationState,
        });
      } else {
        console.log("⚠️ Follow button not visible");
      }
    } else {
      console.log("⚠️ No follow recommendations found");
    }
  } catch (error: any) {
    console.error("❌ Follow action failed:", error.message);
    throw error;
  }
}

async function browseNotifications(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
  cursor: any,
) {
  try {
    console.log("🔔 Browsing notifications...");

    // Navigate to notifications
    const notificationsTab = page
      .locator('[data-testid="AppTabBar_Notifications_Link"]')
      .first();
    const isNotificationsVisible = await notificationsTab.isVisible();

    if (isNotificationsVisible) {
      await cursor.click(notificationsTab);
      await page.waitForTimeout(3000 + Math.random() * 2000);

      // Scroll through notifications
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(2000 + Math.random() * 2000);
      }

      console.log("✅ Notifications browsed");

      // Return to home
      const homeTab = page
        .locator('[data-testid="AppTabBar_Home_Link"]')
        .first();
      await cursor.click(homeTab);
      await page.waitForTimeout(2000);
    } else {
      console.log("⚠️ Notifications tab not visible");
    }
  } catch (error: any) {
    console.error("❌ Browse notifications failed:", error.message);
    throw error;
  }
}

async function scrollFeed(page: Page, sessionId: string, liveViewUrl: string) {
  try {
    console.log("📜 Scrolling feed...");

    await ensureOnHomeFeed(page);

    // Human-like scrolling pattern
    const scrollSteps = 3 + Math.floor(Math.random() * 4); // 3-6 scrolls

    for (let i = 0; i < scrollSteps; i++) {
      const scrollAmount = 300 + Math.random() * 400; // 300-700px
      await page.mouse.wheel(0, scrollAmount);

      const pauseTime = 1500 + Math.random() * 2500; // 1.5-4s pause
      await page.waitForTimeout(pauseTime);
    }

    console.log("✅ Feed scrolled");
  } catch (error: any) {
    console.error("❌ Scroll feed failed:", error.message);
    throw error;
  }
}

async function readPost(page: Page, sessionId: string, liveViewUrl: string) {
  try {
    console.log("📖 Reading post...");

    await ensureOnHomeFeed(page);

    const posts = await findPosts(page);
    if (posts.length > 0) {
      const randomPost =
        posts[Math.floor(Math.random() * Math.min(posts.length, 3))];

      await randomPost.scrollIntoViewIfNeeded();

      // Simulate reading time based on post length
      const postText = await randomPost.textContent();
      const readingTime = Math.max(3000, (postText?.length || 100) * 50); // ~50ms per character

      console.log(`📚 Reading for ${Math.round(readingTime / 1000)}s...`);
      await page.waitForTimeout(readingTime);
    }

    console.log("✅ Post read");
  } catch (error: any) {
    console.error("❌ Read post failed:", error.message);
    throw error;
  }
}

async function takeYouTubeBreak(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
) {
  try {
    console.log("🎥 Taking YouTube break...");

    const context = page.context();
    const youtubeTab = await context.newPage();

    await youtubeTab.goto("https://www.youtube.com", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Broadcast secondary tab
    try {
      const liveViewLinks = await browserbase.sessions.debug(testSession!.id);
      const allTabs = liveViewLinks.pages;
      const youtubeTabLiveView = allTabs.find(
        (tab) => tab.url && tab.url.includes("youtube.com"),
      );

      if (youtubeTabLiveView) {
        broadcastToClients({
          type: "secondary_tab_opened",
          tabType: "youtube",
          tabName: "YouTube Break",
          tabUrl: youtubeTabLiveView.debuggerFullscreenUrl,
          message: "Taking a YouTube break - human-like behavior",
        });
      }
    } catch (liveViewError) {
      console.log("⚠️ Could not get YouTube tab live view URL");
    }

    await youtubeTab.waitForTimeout(2000);

    // Scroll through YouTube
    for (let i = 0; i < 4; i++) {
      await youtubeTab.mouse.wheel(0, 400);
      await youtubeTab.waitForTimeout(2000 + Math.random() * 2000);
    }

    // Browse for 10-20 seconds
    const browsingTime = 10000 + Math.random() * 10000;
    await youtubeTab.waitForTimeout(browsingTime);

    // Close YouTube tab
    broadcastToClients({
      type: "secondary_tab_closing",
      tabType: "youtube",
      message: "Closing YouTube tab, returning to X...",
    });

    await youtubeTab.close();

    broadcastToClients({
      type: "secondary_tab_closed",
      tabType: "youtube",
      message: "YouTube break complete",
    });

    await page.waitForTimeout(1000);
    console.log("✅ YouTube break completed");
  } catch (error: any) {
    console.error("❌ YouTube break failed:", error.message);
    throw error;
  }
}

async function browseRandomProfile(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
  cursor: any,
) {
  try {
    console.log("👤 Browsing random profile...");

    await ensureOnHomeFeed(page);

    // Find profile links
    const profileLinks = page.locator('a[href*="/"][href$=""]').filter({
      hasText: /@\w+/,
    });

    const linkCount = await profileLinks.count();

    if (linkCount > 0) {
      const randomLink = profileLinks.nth(
        Math.floor(Math.random() * Math.min(linkCount, 5)),
      );
      const isVisible = await randomLink.isVisible();

      if (isVisible) {
        await cursor.click(randomLink);
        await page.waitForTimeout(3000 + Math.random() * 2000);

        // Browse profile for a bit
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(3000 + Math.random() * 3000);

        // Go back to home
        await page.goBack();
        await page.waitForTimeout(2000);

        console.log("✅ Profile browsed");
      }
    } else {
      console.log("⚠️ No profile links found");
    }
  } catch (error: any) {
    console.error("❌ Browse profile failed:", error.message);
    throw error;
  }
}

async function performRandomBrowsing(
  page: Page,
  sessionId: string,
  liveViewUrl: string,
) {
  try {
    console.log("🎲 Performing random browsing...");

    const randomActions = ["scroll", "pause", "click_trending", "search"];
    const action =
      randomActions[Math.floor(Math.random() * randomActions.length)];

    switch (action) {
      case "scroll":
        await page.mouse.wheel(0, 200 + Math.random() * 400);
        await page.waitForTimeout(2000 + Math.random() * 3000);
        break;
      case "pause":
        await page.waitForTimeout(5000 + Math.random() * 5000);
        break;
      case "click_trending":
        const trendingLink = page.locator('text="Trending"').first();
        const isTrendingVisible = await trendingLink.isVisible();
        if (isTrendingVisible) {
          await trendingLink.click();
          await page.waitForTimeout(3000);
          await page.goBack();
        }
        break;
      case "search":
        const searchBox = page
          .locator('[data-testid="SearchBox_Search_Input"]')
          .first();
        const isSearchVisible = await searchBox.isVisible();
        if (isSearchVisible) {
          await searchBox.click();
          await page.waitForTimeout(1000);
          await page.keyboard.press("Escape");
        }
        break;
    }

    console.log(`✅ Random browsing: ${action}`);
  } catch (error: any) {
    console.error("❌ Random browsing failed:", error.message);
    throw error;
  }
}

// Helper functions
async function ensureOnHomeFeed(page: Page) {
  try {
    const currentUrl = await page.url();
    if (!currentUrl.includes("/home") && !currentUrl.includes("/following")) {
      console.log("🏠 Navigating to home feed...");
      await page.goto("https://x.com/home", {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(3000);
    }
  } catch (error) {
    console.log("⚠️ Failed to navigate to home feed:", (error as Error).message);
  }
}

async function findPosts(page: Page) {
  try {
    const postSelectors = [
      '[data-testid="tweet"]',
      'article[data-testid="tweet"]',
      'div[data-testid="tweet"]',
    ];

    for (const selector of postSelectors) {
      const posts = page.locator(selector);
      const count = await posts.count();

      if (count > 0) {
        const visiblePosts = [];
        for (let i = 0; i < Math.min(count, 10); i++) {
          const post = posts.nth(i);
          const isVisible = await post.isVisible();
          if (isVisible) {
            visiblePosts.push(post);
          }
        }
        return visiblePosts;
      }
    }

    return [];
  } catch (error) {
    console.log("⚠️ Failed to find posts:", (error as Error).message);
    return [];
  }
}

// Human-like typing function with realistic behavior patterns
async function typeWithHumanBehavior(page: Page, text: string) {
  try {
    console.log(`🎯 Typing "${text}" with human-like behavior...`);

    let typoMade = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Random thinking pause (8% chance)
      if (Math.random() < 0.08) {
        const thinkingDelay = 400 + Math.random() * 800;
        console.log(`🤔 Thinking pause: ${Math.round(thinkingDelay)}ms`);
        await page.waitForTimeout(thinkingDelay);
      }

      // Occasional typo simulation (only once per text, 3% chance, after 25% of text)
      if (
        !typoMade &&
        Math.random() < 0.03 &&
        i > Math.floor(text.length * 0.25)
      ) {
        console.log("❌ Making a single typo...");
        typoMade = true;

        const wrongChars = "qwertyuiopasdfghjklzxcvbnm";
        const wrongChar =
          wrongChars[Math.floor(Math.random() * wrongChars.length)];
        await page.keyboard.type(wrongChar);

        await page.waitForTimeout(200 + Math.random() * 300);
        await page.keyboard.press("Backspace");
        await page.waitForTimeout(100 + Math.random() * 200);

        console.log("🔙 Correcting typo...");
      }

      // Random backspace and retype (2% chance, but not on first few chars)
      if (Math.random() < 0.02 && i > 5) {
        console.log("🔄 Deleting and retyping...");

        const deleteCount = 2 + Math.floor(Math.random() * 3);
        for (let d = 0; d < deleteCount; d++) {
          await page.keyboard.press("Backspace");
          await page.waitForTimeout(80 + Math.random() * 120);
        }

        await page.waitForTimeout(300 + Math.random() * 400);

        const startIndex = Math.max(0, i - deleteCount + 1);
        const retypeText = text.substring(startIndex, i + 1);

        for (const retypeChar of retypeText) {
          await page.keyboard.type(retypeChar);
          const retypeDelay = 90 + Math.random() * 120;
          await page.waitForTimeout(retypeDelay);
        }

        console.log(`✅ Retyped: "${retypeText}"`);
        continue;
      }

      if (char === ' ' && Math.random() < 0.15) {
        const wordThinkingDelay = 300 + Math.random() * 700;
        console.log(`💭 Word thinking pause: ${Math.round(wordThinkingDelay)}ms`);
        await page.waitForTimeout(wordThinkingDelay);
      }

      // Type the character with variable speed
      await page.keyboard.type(char);

      // Calculate realistic delay based on character type
      let baseDelay = 120 + Math.random() * 180; // 120-300ms base

      if (char === " ") {
        baseDelay += 80;
      } else if (char.match(/[.!?]/)) {
        baseDelay += 150;
      } else if (char.match(/[,;:]/)) {
        baseDelay += 100;
      } else if (char.match(/[A-Z]/)) {
        baseDelay += 50;
      } else if (char.match(/[0-9]/)) {
        baseDelay += 30;
      }

      const variation = (Math.random() - 0.5) * 100;
      const finalDelay = Math.max(50, baseDelay + variation);

      await page.waitForTimeout(finalDelay);

      // Occasional longer pause mid-sentence (2% chance)
      if (Math.random() < 0.02 && char !== " ") {
        const midPause = 500 + Math.random() * 1000;
        console.log(`⏸️ Mid-sentence pause: ${Math.round(midPause)}ms`);
        await page.waitForTimeout(midPause);
      }
    }

    console.log(`✅ Finished typing with human-like behavior`);
  } catch (error: any) {
    console.error("❌ Human typing error:", error.message);
    await page.keyboard.type(text, { delay: 100 });
  }
}

// Extract post content from a specific post element
async function extractPostContentFromElement(
  postElement: any,
): Promise<string> {
  try {
    console.log("📝 Extracting post content from specific post...");

    const postSelectors = [
      '[data-testid="tweetText"]',
      "[lang]",
      '[dir="auto"]',
      "span",
    ];

    let extractedText = "";

    for (const selector of postSelectors) {
      try {
        const elements = postElement.locator(selector);
        const count = await elements.count();

        if (count > 0) {
          const texts = await elements.allTextContents();
          const combinedText = texts.join(" ").trim();

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
      extractedText = extractedText.replace(/\s+/g, " ").trim();

      if (extractedText.length > 500) {
        extractedText = extractedText.substring(0, 497) + "...";
      }

      console.log(
        "📄 Extracted post content:",
        extractedText.substring(0, 100) + "...",
      );
      return extractedText;
    } else {
      console.log("⚠️ No post content found, using fallback");
      return "Interesting post! Thanks for sharing.";
    }
  } catch (error: any) {
    console.error("❌ Post content extraction failed:", error.message);
    return "Great post! Thanks for sharing this.";
  }
}

async function monitorSessionHealth(page: Page, sessionId: string): Promise<boolean> {
  try {
    console.log("🔍 Monitoring session health...");
    
    // Check for detection indicators
    const detectionIndicators = [
      'text="Your account has been locked"',
      'text="Suspicious activity detected"',
      'text="Please verify your identity"',
      'text="Account temporarily restricted"',
      '[data-testid="error"]',
    ];
    
    for (const indicator of detectionIndicators) {
      const isPresent = await page.locator(indicator).isVisible().catch(() => false);
      if (isPresent) {
        console.log(`🚨 Detection indicator found: ${indicator}`);
        return false;
      }
    }
    
    // Check if still logged in
    const isLoggedIn = await checkIfLoggedIn(page);
    if (!isLoggedIn) {
      console.log("🚨 Session lost - no longer logged in");
      return false;
    }
    
    // Check for Cloudflare challenges
    const cloudflareDetected = await detectCloudflareChallenge(page);
    if (cloudflareDetected) {
      console.log("🚨 Cloudflare challenge detected during session");
      return false;
    }
    
    console.log("✅ Session health check passed");
    return true;
  } catch (error: any) {
    console.error("❌ Session health check failed:", error.message);
    return false;
  }
}

async function applyStealthModifications(page: Page): Promise<void> {
  try {
    console.log("🥷 Applying comprehensive advanced stealth modifications...");
    
    await page.addInitScript(() => {
      delete (window.navigator as any).webdriver;
      delete (window as any).chrome;
      delete (window as any).__webdriver_evaluate;
      delete (window as any).__selenium_evaluate;
      delete (window as any).__webdriver_script_function;
      delete (window as any).__webdriver_script_func;
      delete (window as any).__webdriver_script_fn;
      delete (window as any).__fxdriver_evaluate;
      delete (window as any).__driver_unwrapped;
      delete (window as any).__webdriver_unwrapped;
      delete (window as any).__driver_evaluate;
      delete (window as any).__selenium_unwrapped;
      delete (window as any).__fxdriver_unwrapped;
      delete (window as any).__webdriver_unwrapped;
      delete (window as any).__driver_evaluate;
      delete (window as any).__selenium_unwrapped;
      delete (window as any).__fxdriver_unwrapped;
      
      // Enhanced navigator properties with realistic values
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' }
        ],
        configurable: true
      });
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true
      });
      
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
        configurable: true
      });
      
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => Math.floor(Math.random() * 4) + 4, // 4-7 cores
        configurable: true
      });
      
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => Math.pow(2, Math.floor(Math.random() * 3) + 3), // 8, 16, or 32 GB
        configurable: true
      });
      
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
        configurable: true
      });
      
      // Enhanced permissions API spoofing
      if (navigator.permissions && navigator.permissions.query) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters: any) => {
          if (parameters.name === 'notifications') {
            return Promise.resolve({ state: 'default' } as any);
          }
          return originalQuery(parameters);
        };
      }
      
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
        const shift = Math.floor(Math.random() * 3) - 1; // Smaller shift: -1 to +1
        const imageData = this.getContext('2d')?.getImageData(0, 0, this.width, this.height);
        if (imageData && imageData.data.length > 0) {
          for (let i = 0; i < imageData.data.length; i += 40) { // Every 10th pixel instead of every pixel
            imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + shift));
          }
          this.getContext('2d')?.putImageData(imageData, 0, 0);
        }
        return originalToDataURL.call(this, type, quality);
      };
      
      // Enhanced WebGL fingerprinting with realistic vendor/renderer values
      const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return 'Google Inc. (Intel)';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        }
        return originalGetParameter.call(this, parameter);
      };
      
      const originalFetch = window.fetch;
      window.fetch = function(input, init) {
        if (typeof input === 'string' && (
          input.includes('challenges.cloudflare.com') ||
          input.includes('/turnstile/') ||
          input.includes('/cf-challenge/')
        )) {
          console.log('🛡️ Applying CORS workaround for Cloudflare resource:', input);
          return originalFetch(input, {
            ...init,
            mode: 'no-cors',
            credentials: 'omit',
            headers: {
              ...((init as any)?.headers || {}),
              'Origin': window.location.origin,
              'Referer': window.location.href
            }
          });
        }
        return originalFetch(input, init);
      };
      
      // Enhanced XHR CORS handling
      const originalXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null) {
        if (typeof url === 'string' && (
          url.includes('challenges.cloudflare.com') ||
          url.includes('/turnstile/') ||
          url.includes('/cf-challenge/')
        )) {
          console.log('🛡️ Applying CORS workaround for XHR Cloudflare resource:', url);
          this.withCredentials = false;
        }
        return originalXHROpen.call(this, method, url, async ?? true, user, password);
      };
      
      Object.defineProperty(screen, 'colorDepth', {
        get: () => 24,
        configurable: true
      });
      
      Object.defineProperty(screen, 'pixelDepth', {
        get: () => 24,
        configurable: true
      });
      
      Object.defineProperty(window, 'outerHeight', {
        get: () => window.innerHeight,
        configurable: true
      });
      
      Object.defineProperty(window, 'outerWidth', {
        get: () => window.innerWidth,
        configurable: true
      });
      
      Object.defineProperty(window, 'chrome', {
        get: () => ({
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        }),
        configurable: true
      });
      
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
        navigator.mediaDevices.enumerateDevices = function() {
          return Promise.resolve([
            { deviceId: 'default', kind: 'audioinput', label: 'Default - Microphone', groupId: 'group1' },
            { deviceId: 'default', kind: 'audiooutput', label: 'Default - Speaker', groupId: 'group1' },
            { deviceId: 'default', kind: 'videoinput', label: 'Default - Camera', groupId: 'group2' }
          ] as MediaDeviceInfo[]);
        };
      }
    });
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'max-age=0'
    });
    
    console.log("✅ Refined stealth modifications applied successfully");
  } catch (error: any) {
    console.error("❌ Failed to apply advanced stealth modifications:", error.message);
    throw error;
  }
}

// Monitor and handle CORS errors specifically for Cloudflare challenges
async function handleCorsErrors(page: Page): Promise<void> {
  try {
    page.on('response', async (response) => {
      const url = response.url();
      if ((url.includes('cloudflare') || url.includes('turnstile') || url.includes('cf-challenge')) && !response.ok()) {
        console.log(`🛡️ Cloudflare challenge resource blocked: ${url}`);
        console.log(`Status: ${response.status()}, Headers:`, await response.allHeaders().catch(() => ({})));
      }
    });
    
    page.on('requestfailed', (request) => {
      const url = request.url();
      if (url.includes('cloudflare') || url.includes('turnstile') || url.includes('cf-challenge')) {
        console.log(`🛡️ Cloudflare challenge request failed: ${url}`);
        console.log(`Failure text: ${request.failure()?.errorText || 'Unknown error'}`);
      }
    });
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('CORS') || text.includes('Access-Control-Allow-Origin')) {
        console.log(`🛡️ CORS-related console message: ${text}`);
      }
    });
    
    console.log("✅ CORS error monitoring enabled");
  } catch (error: any) {
    console.error("❌ Failed to setup CORS error monitoring:", error.message);
  }
}

// Detect if Cloudflare security challenge is present
async function detectCloudflareChallenge(page: Page): Promise<boolean> {
  try {
    const cloudflareIndicators = [
      'text="Verify you are human"',
      'text="X.com needs to review the security of your connection"',
      '[src*="cloudflare"]',
      'text="Cloudflare"',
      'text="Please complete the security check"',
      'text="Checking your browser"',
      'text="This process is automatic"',
      'text="DDoS protection by Cloudflare"',
      ".cf-challenge-running",
      "#cf-challenge-stage",
      '[data-cf-challenge]',
      'iframe[src*="challenges.cloudflare.com"]',
      'iframe[src*="turnstile"]',
      '.cf-turnstile',
      '#cf-turnstile',
    ];

    for (const indicator of cloudflareIndicators) {
      const isPresent = await page
        .locator(indicator)
        .isVisible()
        .catch(() => false);
      if (isPresent) {
        console.log(
          `🛡️ Cloudflare challenge detected with indicator: ${indicator}`,
        );
        return true;
      }
    }

    const currentUrl = await page.url();
    if (
      currentUrl.includes("cloudflare") ||
      currentUrl.includes("challenge") ||
      currentUrl.includes("access")
    ) {
      console.log(`🛡️ Cloudflare challenge detected in URL: ${currentUrl}`);
      return true;
    }

    return false;
  } catch (error) {
    console.log("⚠️ Error detecting Cloudflare challenge:", (error as Error).message);
    return false;
  }
}

export default router;
