import { Router } from "express";
import puppeteer from "puppeteer-core";
import { z } from "zod";
import { WebSocket } from "ws";

const router = Router();

// Global browser instance for testing
let testBrowser: any = null;
let testPage: any = null;
let testClient: any = null;
let isConnected = false;
let isStreaming = false;
let streamingSockets: Set<WebSocket> = new Set();

const BROWSER_ENDPOINT = process.env.PUPPETEER_ENDPOINT;
const API_TOKEN = process.env.API_TOKEN;

if (!BROWSER_ENDPOINT) {
  console.error("PUPPETEER_ENDPOINT not found in environment variables");
}

// Validation schemas
const navigateSchema = z.object({
  url: z.string().url("Invalid URL format")
});

const controlSchema = z.object({
  type: z.enum(["click", "type", "scroll"]),
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
  deltaY: z.number().optional()
});

// WebSocket message handler for browser control
export function handleBrowserWebSocket(ws: WebSocket) {
  console.log("Browser control WebSocket connected");
  streamingSockets.add(ws);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'browser_control' && testPage && isConnected) {
        const { action } = message;
        
        // Check if browser session is still active
        try {
          await testPage.evaluate(() => window.location.href);
        } catch (error: any) {
          console.log("Browser session lost, skipping control action");
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Browser session lost'
          }));
          return;
        }
        
        switch (action.type) {
          case 'click':
            await testPage.mouse.click(action.x, action.y);
            console.log(`Browser click at ${action.x}, ${action.y}`);
            ws.send(JSON.stringify({
              type: 'control_feedback',
              action: 'click',
              x: action.x,
              y: action.y
            }));
            break;
            
          case 'type':
            await testPage.keyboard.type(action.text);
            console.log(`Browser type: ${action.text}`);
            break;
            
          case 'scroll':
            await testPage.mouse.wheel({ deltaY: action.deltaY });
            console.log(`Browser scroll: ${action.deltaY}`);
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

// Bright Data's official live view method from documentation
async function openDevtools(page: any, client: any) {
  const frameId = page.mainFrame()._id;
  // Get URL for live browser view from Bright Data
  const { url: inspectUrl } = await client.send('Page.inspect', { frameId });
  return inspectUrl; // Return URL for frontend iframe
}

// Start live streaming with Bright Data's official method
async function startScreenStreaming() {
  if (!testPage || !testClient || isStreaming) return;

  try {
    console.log("Starting live screen streaming...");
    
    // Try Bright Data's official live view method first
    try {
      const liveViewUrl = await openDevtools(testPage, testClient);
      console.log('Live view URL obtained:', liveViewUrl);
      
      // Send live view URL to all connected WebSocket clients
      streamingSockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'live_view_url',
            url: liveViewUrl
          }));
        }
      });

      isStreaming = true;
      console.log("Live view streaming started successfully");
      return;
    } catch (liveViewError: any) {
      console.log("Live view method failed, falling back to screencast:", liveViewError.message);
    }
    
    // Fallback to screencast method
    await testClient.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 90,
      maxWidth: 1400,
      maxHeight: 900,
      everyNthFrame: 1
    });

    testClient.on('Page.screencastFrame', (params: any) => {
      // Broadcast frame to all connected WebSocket clients
      const frameMessage = JSON.stringify({
        type: 'browser_frame',
        data: params.data,
        metadata: {
          sessionId: params.sessionId,
          timestamp: Date.now()
        }
      });

      streamingSockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(frameMessage);
        }
      });

      // Acknowledge frame
      testClient.send('Page.screencastFrameAck', {
        sessionId: params.sessionId
      });
    });

    isStreaming = true;
    console.log("Fallback screencast streaming started successfully");
    
  } catch (error) {
    console.error("Failed to start streaming:", error);
  }
}

// Stop live streaming
async function stopScreenStreaming() {
  if (!testClient || !isStreaming) return;

  try {
    await testClient.send('Page.stopScreencast');
    isStreaming = false;
    console.log("Live streaming stopped");
  } catch (error) {
    console.error("Failed to stop streaming:", error);
  }
}

// Test browser connection
router.post("/test-connection", async (req, res) => {
  console.log("Testing Bright Data connection...");
  
  try {
    // Close existing connection if any
    if (testBrowser) {
      try {
        await testBrowser.close();
      } catch (e) {
        console.log("Previous browser already closed");
      }
      testBrowser = null;
      testPage = null;
    }

    // Connect to Bright Data browser
    console.log("Connecting to Bright Data endpoint:", BROWSER_ENDPOINT?.substring(0, 50) + "...");
    
    testBrowser = await puppeteer.connect({
      browserWSEndpoint: BROWSER_ENDPOINT,
      defaultViewport: { width: 1280, height: 720 }
    });

    testPage = await testBrowser.newPage();
    
    // Set user agent to look more natural
    await testPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Create CDP client for live streaming
    testClient = await testPage.target().createCDPSession();
    
    console.log("Browser connected successfully");
    isConnected = true;

    res.json({
      success: true,
      message: "Successfully connected to Bright Data browser",
      browserEndpoint: BROWSER_ENDPOINT?.substring(0, 50) + "...",
      status: "connected"
    });

  } catch (error: any) {
    console.error("Browser connection error:", error);
    isConnected = false;
    testBrowser = null;
    testPage = null;
    testClient = null;
    
    res.status(500).json({
      success: false,
      message: "Failed to connect to Bright Data browser",
      error: error.message,
      status: "disconnected"
    });
  }
});

// Navigate to URL
router.post("/navigate", async (req, res) => {
  try {
    const { url } = navigateSchema.parse(req.body);
    
    if (!testPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    console.log("Navigating to:", url);
    
    // Navigate with timeout
    await testPage.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait a bit for page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const currentUrl = await testPage.url();
    const title = await testPage.title();

    console.log("Navigation successful:", currentUrl);

    res.json({
      success: true,
      message: "Navigation successful",
      currentUrl,
      title,
      status: "loaded"
    });

  } catch (error: any) {
    console.error("Navigation error:", error);
    res.status(500).json({
      success: false,
      message: "Navigation failed",
      error: error.message
    });
  }
});

// Start live streaming
router.post("/start-streaming", async (req, res) => {
  try {
    if (!testPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    if (isStreaming) {
      return res.json({
        success: true,
        message: "Live streaming already active",
        isStreaming: true
      });
    }

    await startScreenStreaming();

    res.json({
      success: true,
      message: "Live streaming started",
      isStreaming: true
    });

  } catch (error: any) {
    console.error("Start streaming error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start live streaming",
      error: error.message
    });
  }
});

// Stop live streaming
router.post("/stop-streaming", async (req, res) => {
  try {
    await stopScreenStreaming();

    res.json({
      success: true,
      message: "Live streaming stopped",
      isStreaming: false
    });

  } catch (error: any) {
    console.error("Stop streaming error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop live streaming",
      error: error.message
    });
  }
});

// Manual browser control endpoint
router.post("/control", async (req, res) => {
  try {
    const action = controlSchema.parse(req.body);
    
    if (!testPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    switch (action.type) {
      case 'click':
        if (action.x !== undefined && action.y !== undefined) {
          await testPage.mouse.click(action.x, action.y);
          console.log(`Manual click at ${action.x}, ${action.y}`);
        }
        break;
        
      case 'type':
        if (action.text) {
          await testPage.keyboard.type(action.text);
          console.log(`Manual type: ${action.text}`);
        }
        break;
        
      case 'scroll':
        if (action.deltaY !== undefined) {
          await testPage.mouse.wheel({ deltaY: action.deltaY });
          console.log(`Manual scroll: ${action.deltaY}`);
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

// Take screenshot (keep for fallback)
router.get("/screenshot", async (req, res) => {
  try {
    if (!testPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    console.log("Taking screenshot...");
    
    const screenshot = await testPage.screenshot({
      encoding: 'base64',
      fullPage: false,
      type: 'png'
    });

    const currentUrl = await testPage.url();
    const title = await testPage.title();

    res.json({
      success: true,
      screenshot: `data:image/png;base64,${screenshot}`,
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

// Test Twitter-specific functionality
router.post("/test-twitter", async (req, res) => {
  try {
    if (!testPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    console.log("Testing Twitter functionality...");
    
    // Navigate to Twitter
    await testPage.goto('https://twitter.com', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for common Twitter elements
    const elements = await testPage.evaluate(() => {
      const loginButton = document.querySelector('[data-testid="loginButton"]');
      const signUpButton = document.querySelector('[data-testid="signupButton"]');
      const twitterLogo = document.querySelector('[aria-label="Twitter"]');
      
      return {
        loginButtonExists: !!loginButton,
        signUpButtonExists: !!signUpButton,
        twitterLogoExists: !!twitterLogo,
        pageTitle: document.title,
        currentUrl: window.location.href
      };
    });

    // Take screenshot
    const screenshot = await testPage.screenshot({
      encoding: 'base64',
      fullPage: false,
      type: 'png'
    });

    res.json({
      success: true,
      message: "Twitter test completed",
      elements,
      screenshot: `data:image/png;base64,${screenshot}`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Twitter test error:", error);
    res.status(500).json({
      success: false,
      message: "Twitter test failed",
      error: error.message
    });
  }
});

// Get session status
router.get("/status", async (req, res) => {
  try {
    let currentUrl = null;
    let title = null;
    
    if (testPage && isConnected) {
      try {
        currentUrl = await testPage.url();
        title = await testPage.title();
      } catch (e) {
        console.log("Error getting page info:", e);
        isConnected = false;
      }
    }

    res.json({
      success: true,
      isConnected,
      isStreaming,
      currentUrl,
      title,
      browserEndpoint: BROWSER_ENDPOINT ? BROWSER_ENDPOINT.substring(0, 50) + "..." : null,
      connectedClients: streamingSockets.size,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Status check error:", error);
    res.json({
      success: false,
      isConnected: false,
      error: error.message
    });
  }
});

// Close browser session
router.delete("/session", async (req, res) => {
  try {
    console.log("Closing browser session...");
    
    // Stop streaming first
    await stopScreenStreaming();
    
    if (testBrowser) {
      await testBrowser.close();
      console.log("Browser session closed");
    }
    
    testBrowser = null;
    testPage = null;
    testClient = null;
    isConnected = false;
    
    // Clear all WebSocket connections
    streamingSockets.clear();

    res.json({
      success: true,
      message: "Browser session closed successfully",
      status: "disconnected"
    });

  } catch (error: any) {
    console.error("Session close error:", error);
    testBrowser = null;
    testPage = null;
    isConnected = false;
    
    res.json({
      success: true,
      message: "Browser session closed (with errors)",
      error: error.message,
      status: "disconnected"
    });
  }
});

export default router;