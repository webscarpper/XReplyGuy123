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
let liveViewUrl: string | null = null;

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
  type: z.enum(["click", "type", "scroll", "key"]),
  x: z.number().optional(),
  y: z.number().optional(),
  text: z.string().optional(),
  deltaY: z.number().optional(),
  key: z.string().optional()
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
        
      case 'key':
        if (action.key) {
          // Handle key combinations like Ctrl+A
          if (action.key.includes('+')) {
            const keys = action.key.split('+');
            const modifiers = keys.slice(0, -1);
            const key = keys[keys.length - 1].toLowerCase();
            
            // Press modifier keys
            for (const modifier of modifiers) {
              await testPage.keyboard.down(modifier);
            }
            
            // Press the main key
            await testPage.keyboard.press(key);
            
            // Release modifier keys in reverse order
            for (const modifier of modifiers.reverse()) {
              await testPage.keyboard.up(modifier);
            }
            
            console.log(`Manual key combination: ${action.key}`);
          } else {
            // Single key press
            await testPage.keyboard.press(action.key);
            console.log(`Manual key: ${action.key}`);
          }
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

// Get current browser screenshot
router.get("/screenshot", async (req, res) => {
  try {
    if (!testPage || !isConnected) {
      return res.json({ success: false, message: 'No active browser session' });
    }

    // Take screenshot of current browser state
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
    console.error('Screenshot error:', error);
    res.json({ success: false, message: 'Error capturing screenshot', error: error.message });
  }
});

// Get current live view URL
router.get("/live-view-url", async (req, res) => {
  try {
    if (!testPage || !testClient || !isConnected) {
      return res.json({ success: false, message: 'No active browser session' });
    }

    // If we don't have a live view URL yet, generate one
    if (!liveViewUrl) {
      try {
        liveViewUrl = await openDevtools(testPage, testClient);
        console.log("Generated new live view URL:", liveViewUrl);
      } catch (error: any) {
        console.error("Failed to generate live view URL:", error);
        return res.json({ success: false, message: 'Failed to generate live view URL' });
      }
    }

    res.json({ 
      success: true, 
      liveViewUrl: liveViewUrl,
      message: 'Live view URL retrieved successfully' 
    });
  } catch (error: any) {
    console.error('Get live view URL error:', error);
    res.json({ success: false, message: 'Error retrieving live view URL', error: error.message });
  }
});

// Continue automation after manual login
router.post("/continue-automation", async (req, res) => {
  try {
    if (!testPage || !isConnected) {
      return res.json({ success: false, message: 'No active browser session' });
    }

    console.log("Manual login completed, continuing automation...");
    
    // Continue with post-login automation steps
    console.log("STEP 4: Proceeding with post-login automation...");
    
    try {
      // Check if browser session is still active
      await testPage.evaluate(() => window.location.href);
      
      // Navigate to search and interact with posts
      await testPage.goto('https://x.com/search?q=crypto%20AI%20automation&src=typed_query&f=live', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
    } catch (error: any) {
      console.error("Browser session lost during continuation:", error);
      throw new Error("Browser session disconnected. Please restart automation.");
    }
    
    // Wait for posts to load and interact
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("STEP 5: Finding and interacting with posts...");
    
    // Notify about continued automation
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_status',
          status: 'continuing',
          message: 'Automation continued successfully! Now interacting with posts...',
          step: 4,
          totalSteps: 8,
          estimatedTime: '2-3 minutes remaining'
        }));
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Automation continued successfully' 
    });
  } catch (error: any) {
    console.error('Continue automation error:', error);
    res.json({ success: false, message: 'Error continuing automation', error: error.message });
  }
});

// Force login detection check
router.post("/check-login", async (req, res) => {
  try {
    if (!testPage || !isConnected) {
      return res.json({ success: false, message: 'No active browser session' });
    }

    const currentUrl = await testPage.url();
    const loginSuccess = await testPage.evaluate(() => {
      // Check for multiple indicators of successful login
      const homeButton = document.querySelector('[data-testid="AppTabBar_Home_Link"]');
      const profileButton = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
      const composeButton = document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
      const tweetComposer = document.querySelector('[data-testid="tweetTextarea_0"]');
      const posts = document.querySelectorAll('[data-testid="tweet"]');
      const userAvatar = document.querySelector('[data-testid="DashButton_ProfileIcon_Link"]');
      const sideNav = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      
      // Check URL patterns
      const urlIndicators = window.location.href.includes('/home') || 
                           window.location.href.includes('x.com') && !window.location.href.includes('/login') &&
                           !window.location.href.includes('/i/flow');
      
      // Check for tweet timeline content
      const hasContent = posts.length > 0 || !!tweetComposer;
      
      return {
        loginDetected: !!(homeButton || profileButton || composeButton || userAvatar || sideNav || (urlIndicators && hasContent)),
        indicators: {
          homeButton: !!homeButton,
          profileButton: !!profileButton,
          composeButton: !!composeButton,
          posts: posts.length,
          userAvatar: !!userAvatar,
          sideNav: !!sideNav,
          url: window.location.href,
          urlIndicators,
          hasContent
        }
      };
    });

    res.json({ 
      success: true, 
      loginDetected: loginSuccess.loginDetected,
      message: loginSuccess.loginDetected ? 'Login detected successfully!' : 'Login not detected yet',
      indicators: loginSuccess.indicators,
      currentUrl
    });
  } catch (error: any) {
    console.error('Login check error:', error);
    res.json({ success: false, message: 'Error checking login status', error: error.message });
  }
});

// Test Automation - Complete X/Twitter automation flow
router.post("/test-automation", async (req, res) => {
  try {
    if (!testPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: "No active browser session. Please test connection first."
      });
    }

    console.log("Starting comprehensive X/Twitter automation...");

    // Send initial status
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_status',
          status: 'starting',
          message: 'Initializing X/Twitter automation',
          step: 1,
          totalSteps: 8,
          estimatedTime: '5-10 minutes'
        }));
      }
    });

    // STEP 1: Navigate to X login page
    console.log("STEP 1: Navigating to X login page...");
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_progress',
          currentAction: 'Navigating to X login page',
          progress: 12.5,
          nextStep: 'Manual login handoff'
        }));
      }
    });

    await testPage.goto('https://x.com/i/flow/login', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // STEP 2: Start live streaming and open login tab
    console.log("STEP 2: Starting live stream and opening login tab...");
    
    // Start streaming automatically and get live view URL
    await startScreenStreaming();
    
    // Wait a moment for live view URL to be generated
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the current live view URL for the tab
    const currentLiveViewUrl = liveViewUrl || await openDevtools(testPage, testClient);
    
    // Store the live view URL globally
    liveViewUrl = currentLiveViewUrl;
    
    console.log("Using live view URL for login tab:", currentLiveViewUrl);
    
    // Send request to open new tab with live browser
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'open_login_tab',
          liveViewUrl: currentLiveViewUrl,
          message: 'Opening live browser tab for manual login',
          instructions: 'A new tab will open with the live browser. Please log in to X/Twitter there and click "Continue Automation" when done.'
        }));
      }
    });

    // STEP 3: Login Detection Loop
    console.log("STEP 3: Waiting for login completion...");
    let loginDetected = false;
    let attempts = 0;
    const maxAttempts = 100; // 5 minutes (3 second intervals)

    while (!loginDetected && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;

      try {
        const currentUrl = await testPage.url();
        const loginSuccess = await testPage.evaluate(() => {
          // Check for multiple indicators of successful login
          const homeButton = document.querySelector('[data-testid="AppTabBar_Home_Link"]');
          const profileButton = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
          const composeButton = document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
          const tweetComposer = document.querySelector('[data-testid="tweetTextarea_0"]');
          const posts = document.querySelectorAll('[data-testid="tweet"]');
          const userAvatar = document.querySelector('[data-testid="DashButton_ProfileIcon_Link"]');
          const sideNav = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
          
          // Check URL patterns
          const urlIndicators = window.location.href.includes('/home') || 
                               window.location.href.includes('x.com') && !window.location.href.includes('/login') &&
                               !window.location.href.includes('/i/flow');
          
          // Check for tweet timeline content
          const hasContent = posts.length > 0 || !!tweetComposer;
          
          console.log('Login detection:', {
            homeButton: !!homeButton,
            profileButton: !!profileButton,
            composeButton: !!composeButton,
            posts: posts.length,
            userAvatar: !!userAvatar,
            sideNav: !!sideNav,
            url: window.location.href,
            urlIndicators,
            hasContent
          });
          
          return !!(homeButton || profileButton || composeButton || userAvatar || sideNav || (urlIndicators && hasContent));
        });

        if (loginSuccess || currentUrl.includes('/home') || (currentUrl.includes('x.com') && !currentUrl.includes('/login'))) {
          loginDetected = true;
          console.log("Login detected successfully!");
          
          streamingSockets.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'automation_status',
                status: 'login_detected',
                message: 'Login successful! Continuing automation...',
                step: 3,
                totalSteps: 8,
                estimatedTime: '3-5 minutes remaining'
              }));
            }
          });
        } else {
          // Send periodic status updates
          if (attempts % 10 === 0) {
            streamingSockets.forEach(ws => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'automation_status',
                  status: 'waiting_login',
                  message: `Waiting for login... (${Math.floor(attempts * 3 / 60)}:${(attempts * 3 % 60).toString().padStart(2, '0')})`,
                  step: 3,
                  totalSteps: 8
                }));
              }
            });
          }
        }
      } catch (error) {
        console.log("Login check error:", error);
      }
    }

    if (!loginDetected) {
      throw new Error("Login timeout - please try again");
    }

    // STEP 4: Navigate to home feed
    console.log("STEP 4: Navigating to home feed...");
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_progress',
          currentAction: 'Navigating to home feed',
          progress: 50,
          nextStep: 'Finding posts to interact with'
        }));
      }
    });

    await testPage.goto('https://x.com/home', { 
      waitUntil: 'networkidle0',
      timeout: 15000 
    });

    // STEP 5: Scroll to find 10th post
    console.log("STEP 5: Finding posts to interact with...");
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_progress',
          currentAction: 'Scrolling to find posts',
          progress: 62.5,
          nextStep: 'Interacting with post'
        }));
      }
    });

    // Scroll and find posts
    let posts = [];
    let scrollAttempts = 0;
    
    while (posts.length < 10 && scrollAttempts < 5) {
      await testPage.evaluate(() => window.scrollBy(0, 800));
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      posts = await testPage.$$('[data-testid="tweet"]');
      scrollAttempts++;
    }

    if (posts.length < 10) {
      console.log(`Found ${posts.length} posts, proceeding with available posts`);
    }

    // STEP 6: Click on post (use available post if less than 10)
    const targetPost = posts[Math.min(9, posts.length - 1)];
    if (targetPost) {
      console.log("STEP 6: Clicking on post...");
      await targetPost.click();
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // STEP 7: Like the post
    console.log("STEP 7: Liking the post...");
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_progress',
          currentAction: 'Liking post',
          progress: 75,
          nextStep: 'Adding reply comment'
        }));
      }
    });

    try {
      const likeButton = await testPage.$('[data-testid="like"]');
      if (likeButton) {
        await likeButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log("Like button not found, continuing...");
    }

    // STEP 8: Reply to post
    console.log("STEP 8: Adding reply...");
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_progress',
          currentAction: 'Composing reply',
          progress: 87.5,
          nextStep: 'Submitting reply'
        }));
      }
    });

    try {
      const replyButton = await testPage.$('[data-testid="reply"]');
      if (replyButton) {
        await replyButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        const commentBox = await testPage.$('[data-testid="tweetTextarea_0"]');
        if (commentBox) {
          await commentBox.type("That's interesting!", { delay: 100 });
          await new Promise(resolve => setTimeout(resolve, 1000));

          const submitButton = await testPage.$('[data-testid="tweetButtonInline"]');
          if (submitButton) {
            await submitButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    } catch (error) {
      console.log("Reply interaction error:", error);
    }

    // Automation Complete
    console.log("Automation completed successfully!");
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_complete',
          success: true,
          summary: 'Successfully completed X/Twitter automation: navigated, logged in, found posts, liked, and replied',
          totalTime: `${Math.floor(attempts * 3 / 60)}:${(attempts * 3 % 60).toString().padStart(2, '0')}`,
          progress: 100
        }));
      }
    });

    res.json({
      success: true,
      message: "Test automation completed successfully",
      steps: {
        navigation: "✓ Navigated to X login",
        login: "✓ Manual login completed",
        posts: `✓ Found ${posts.length} posts`,
        interactions: "✓ Liked and replied to post"
      },
      totalTime: `${Math.floor(attempts * 3 / 60)}:${(attempts * 3 % 60).toString().padStart(2, '0')}`
    });

  } catch (error: any) {
    console.error("Test automation error:", error);
    
    // Send error to WebSocket clients
    streamingSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'automation_error',
          error: error.message,
          step: 'unknown',
          recovery: 'Please try again or check browser connection'
        }));
      }
    });

    res.status(500).json({
      success: false,
      message: "Test automation failed",
      error: error.message
    });
  }
});

// Add automated login endpoint
router.post("/automated-login", async (req, res) => {
  try {
    if (!testPage || !isConnected) {
      return res.status(400).json({
        success: false,
        message: 'No active browser session'
      });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    console.log('Starting automated X/Twitter login...');
    
    // Wait for page to load completely (Puppeteer syntax)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      // Try multiple possible username field selectors
      const usernameSelectors = [
        'input[name="text"]',
        'input[autocomplete="username"]', 
        'input[data-testid="ocfEnterTextTextInput"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="email" i]',
        'input[placeholder*="phone" i]'
      ];
      
      let usernameField = null;
      for (const selector of usernameSelectors) {
        try {
          await testPage.waitForSelector(selector, { timeout: 5000 });
          usernameField = selector;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!usernameField) {
        throw new Error('Could not find username input field');
      }
      
      console.log(`Found username field: ${usernameField}`);
      
      // Clear and fill username
      await testPage.click(usernameField);
      await testPage.keyboard.down('Control');
      await testPage.keyboard.press('a');
      await testPage.keyboard.up('Control');
      await testPage.keyboard.type(username);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find and click Next button
      const nextSelectors = [
        '[data-testid="ocfEnterTextNextButton"]',
        'button[type="button"]'
      ];
      
      let nextClicked = false;
      for (const selector of nextSelectors) {
        try {
          await testPage.waitForSelector(selector, { timeout: 3000 });
          await testPage.click(selector);
          nextClicked = true;
          console.log(`Clicked next button: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!nextClicked) {
        // Try pressing Enter as fallback
        await testPage.keyboard.press('Enter');
        console.log('Pressed Enter as fallback for next button');
      }
      
      // Wait for password field to appear
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[data-testid="ocfEnterTextTextInput"]',
        'input[placeholder*="password" i]'
      ];
      
      let passwordField = null;
      for (const selector of passwordSelectors) {
        try {
          await testPage.waitForSelector(selector, { timeout: 5000 });
          passwordField = selector;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!passwordField) {
        throw new Error('Could not find password input field');
      }
      
      console.log(`Found password field: ${passwordField}`);
      
      // Clear and fill password
      await testPage.click(passwordField);
      await testPage.keyboard.down('Control');
      await testPage.keyboard.press('a');
      await testPage.keyboard.up('Control');
      await testPage.keyboard.type(password);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find and click Login button
      const loginSelectors = [
        '[data-testid="LoginForm_Login_Button"]',
        'button[type="submit"]'
      ];
      
      let loginClicked = false;
      for (const selector of loginSelectors) {
        try {
          await testPage.waitForSelector(selector, { timeout: 3000 });
          await testPage.click(selector);
          loginClicked = true;
          console.log(`Clicked login button: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!loginClicked) {
        // Try pressing Enter as fallback
        await testPage.keyboard.press('Enter');
        console.log('Pressed Enter as fallback for login button');
      }
      
      // Wait for login to complete and check for success
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const currentUrl = testPage.url();
      console.log(`Login completed, current URL: ${currentUrl}`);
      
      res.json({
        success: true,
        message: 'Automated login completed successfully',
        currentUrl: currentUrl
      });
      
    } catch (error: any) {
      console.error('Login step failed:', error);
      throw error;
    }
    
  } catch (error: any) {
    console.error('Automated login failed:', error);
    res.status(500).json({
      success: false,
      message: `Automated login failed: ${error.message}`
    });
  }
});

export default router;