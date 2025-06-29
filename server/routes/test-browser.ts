import { Router } from "express";
import puppeteer from "puppeteer-core";
import { z } from "zod";

const router = Router();

// Global browser instance for testing
let testBrowser: any = null;
let testPage: any = null;
let isConnected = false;

const BROWSER_ENDPOINT = process.env.PUPPETEER_ENDPOINT;
const API_TOKEN = process.env.API_TOKEN;

if (!BROWSER_ENDPOINT) {
  console.error("PUPPETEER_ENDPOINT not found in environment variables");
}

// Validation schemas
const navigateSchema = z.object({
  url: z.string().url("Invalid URL format")
});

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

// Take screenshot
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
      currentUrl,
      title,
      browserEndpoint: BROWSER_ENDPOINT ? BROWSER_ENDPOINT.substring(0, 50) + "..." : null,
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
    
    if (testBrowser) {
      await testBrowser.close();
      console.log("Browser session closed");
    }
    
    testBrowser = null;
    testPage = null;
    isConnected = false;

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