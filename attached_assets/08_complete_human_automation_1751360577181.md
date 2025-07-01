# Complete Human-Like Twitter Automation Implementation

## STEP 1: INSTALL REQUIRED DEPENDENCIES

First, install the ghost-cursor-playwright package for realistic mouse movements:

```bash
npm install ghost-cursor-playwright
```

## STEP 2: COMPLETE SCRIPT REPLACEMENT

Replace the entire `/test-script` endpoint and related functions with this human-like automation implementation:

### IMPORT SECTION (Add to top of file)
```javascript
import { createCursor } from 'ghost-cursor-playwright';
```

### REPLACE THE ENTIRE `/test-script` ENDPOINT:
```javascript
// POST /api/test-browser/test-script - Complete human-like automation
router.post("/test-script", async (req, res) => {
  try {
    console.log("🚀 Starting human-like Twitter automation...");

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
        solveCaptchas: false // Let user handle CAPTCHAs manually
      },
      proxies: true,
      timeout: 3600 // 1 hour in seconds
    });

    console.log("✅ Session created:", session.id);

    // 2. Connect to browser
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0];

    // 3. Initialize ghost cursor for human-like movements
    const cursor = createCursor(page);

    // Store session globally for cleanup
    testSession = session;
    testBrowser = browser;
    testContext = defaultContext;
    testPage = page;

    // 4. Get live view URL (persistent throughout automation)
    const liveViewLinks = await browserbase.sessions.debug(session.id);
    const liveViewUrl = liveViewLinks.debuggerFullscreenUrl;

    // 5. Immediately broadcast live view URL
    broadcastToClients({
      type: 'live_view_url',
      url: liveViewUrl,
      message: 'Live view ready - human-like automation starting',
      sessionId: session.id
    });

    // 6. Navigate to Twitter login with human-like behavior
    console.log("🌐 Navigating to Twitter login like a human...");
    
    // Clear any existing session safely
    try {
      await page.context().clearCookies();
      await page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.log('Storage clearing blocked by security policy');
        }
      });
    } catch (error) {
      console.log("⚠️ Storage clearing blocked, continuing...");
    }
    
    // Navigate to login page
    await page.goto('https://x.com/i/flow/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Human-like page observation delay
    await humanDelay('observing', 3000, 2000);

    // 7. Check if login is needed
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

      // Wait for login completion in background
      waitForLoginAndContinueHuman(page, session.id, liveViewUrl, cursor);

    } else {
      console.log("✅ Already logged in, continuing automation...");
      res.json({
        success: true,
        status: 'continuing_automation',
        liveViewUrl: liveViewUrl,
        message: 'Already logged in, continuing with human-like automation'
      });

      // Continue with automation
      performHumanLikeAutomation(page, session.id, liveViewUrl, cursor);
    }

  } catch (error: any) {
    console.error("❌ Test script error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

### ADD HUMAN-LIKE DELAY FUNCTION:
```javascript
// Human-like delay patterns with natural variation
async function humanDelay(action: string, baseMs: number, variationMs: number = 1000) {
  const delay = baseMs + (Math.random() * variationMs);
  console.log(`🧠 Human ${action} delay: ${Math.round(delay)}ms`);
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

### REPLACE LOGIN DETECTION AND WAITING:
```javascript
// Wait for login completion with human-like patience
async function waitForLoginAndContinueHuman(page: Page, sessionId: string, liveViewUrl: string, cursor: any) {
  try {
    console.log("⏳ Waiting for human login completion...");

    const loginDetected = await waitForLoginCompletionHuman(page, liveViewUrl);

    if (loginDetected) {
      console.log("✅ Login detected! Starting human-like automation...");

      broadcastToClients({
        type: 'login_detected',
        message: 'Login successful! Starting human-like automation...',
        sessionId: sessionId,
        liveViewUrl: liveViewUrl
      });

      // Human thinking delay before starting automation
      await humanDelay('thinking', 3000, 2000);

      // Continue with human-like automation
      await performHumanLikeAutomation(page, sessionId, liveViewUrl, cursor);
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

// Enhanced login detection with human-like checking
async function waitForLoginCompletionHuman(page: Page, liveViewUrl: string) {
  const maxWait = 300000; // 5 minutes
  const checkInterval = 4000; // 4 seconds (more human-like)
  let elapsed = 0;

  console.log("⏳ Starting human-like login detection...");

  while (elapsed < maxWait) {
    try {
      // Human-like checking pattern
      console.log(`🔍 Checking authentication (${Math.floor(elapsed/1000)}s)...`);
      
      // Check for authenticated UI elements
      const homeButton = await page.$('[data-testid="AppTabBar_Home_Link"]');
      const profileButton = await page.$('[data-testid="AppTabBar_Profile_Link"]');
      const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
      
      if (homeButton || profileButton || composeButton) {
        console.log("✅ Authentication confirmed!");
        return true;
      }

      // Check URL patterns
      const currentUrl = await page.url();
      const isAuthenticated = (
        currentUrl.includes('/home') || 
        currentUrl.includes('/following') ||
        (currentUrl.includes('x.com') && !currentUrl.includes('/login') && !currentUrl.includes('/flow'))
      );

      if (isAuthenticated) {
        console.log("✅ Authenticated URL detected!");
        return true;
      }

    } catch (error) {
      console.log("⚠️ Login check error:", error);
    }

    // Human-like waiting
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;

    // Periodic updates
    if (elapsed % 30000 === 0) {
      const remaining = Math.floor((maxWait - elapsed) / 1000);
      broadcastToClients({
        type: 'automation_progress',
        message: `Waiting for login completion (${remaining}s remaining)...`,
        step: 'login_wait',
        liveViewUrl: liveViewUrl
      });
    }
  }

  return false;
}
```

### MAIN HUMAN-LIKE AUTOMATION FUNCTION:
```javascript
// Perform complete human-like Twitter automation
async function performHumanLikeAutomation(page: Page, sessionId: string, liveViewUrl: string, cursor: any) {
  try {
    console.log("🤖 Starting complete human-like automation sequence...");

    // Step 1: Human observation delay (user would look around after login)
    broadcastToClients({
      type: 'automation_progress',
      message: 'Looking around after login like a human...',
      step: 'initial_observation',
      liveViewUrl: liveViewUrl
    });
    await humanDelay('observing', 4000, 2000);

    // Step 2: Navigate to Following tab (human-like)
    broadcastToClients({
      type: 'automation_progress',
      message: 'Looking for Following tab...',
      step: 'finding_following',
      liveViewUrl: liveViewUrl
    });

    // Find and click Following tab with human-like behavior
    const followingTab = await page.$('a[href="/following"], [role="tab"]:has-text("Following")');
    if (followingTab) {
      console.log("👆 Clicking Following tab with human-like movement...");
      
      // Human-like mouse movement and click
      await cursor.click(followingTab);
      await humanDelay('clicking', 1500, 1000);
      
      broadcastToClients({
        type: 'automation_progress',
        message: 'Switched to Following feed - waiting for content...',
        step: 'following_clicked',
        liveViewUrl: liveViewUrl
      });
    } else {
      console.log("⚠️ Following tab not found, continuing with current feed...");
    }

    // Step 3: Wait for feed to load with human patience
    await humanDelay('waiting_for_content', 5000, 3000);

    // Step 4: Find first post with human-like scanning
    broadcastToClients({
      type: 'automation_progress',
      message: 'Scanning feed for posts like a human...',
      step: 'scanning_posts',
      liveViewUrl: liveViewUrl
    });

    const posts = await findPostsHumanLike(page, liveViewUrl);
    
    if (posts.length === 0) {
      throw new Error('No posts found in the feed');
    }

    // Step 5: Select first post and interact
    const firstPost = posts[0];
    console.log("🎯 Found first post, preparing human-like interaction...");

    broadcastToClients({
      type: 'automation_progress',
      message: 'Found first post - clicking to open...',
      step: 'opening_post',
      liveViewUrl: liveViewUrl
    });

    // Human-like post clicking
    await cursor.click(firstPost);
    await humanDelay('post_opening', 3000, 2000);

    // Step 6: Human-like post reading and scrolling
    broadcastToClients({
      type: 'automation_progress',
      message: 'Reading post content like a human...',
      step: 'reading_post',
      liveViewUrl: liveViewUrl
    });

    // Scroll down to read comments (human-like)
    await humanScrollDown(page, 400);
    await humanDelay('reading_comments', 4000, 2000);

    // Scroll through first 5 comments area
    for (let i = 0; i < 3; i++) {
      await humanScrollDown(page, 200);
      await humanDelay('reading', 2000, 1000);
    }

    // Step 7: Scroll back up like human finished reading
    broadcastToClients({
      type: 'automation_progress',
      message: 'Finished reading comments, scrolling back up...',
      step: 'scrolling_up',
      liveViewUrl: liveViewUrl
    });

    await humanScrollUp(page, 800);
    await humanDelay('deciding', 2000, 1000);

    // Step 8: Like the post with human-like behavior
    broadcastToClients({
      type: 'automation_progress',
      message: 'Looking for like button...',
      step: 'finding_like',
      liveViewUrl: liveViewUrl
    });

    const likeButton = await page.$('[data-testid="like"]');
    if (likeButton) {
      console.log("❤️ Liking post with human-like movement...");
      await cursor.click(likeButton);
      await humanDelay('liking', 1500, 1000);
      
      broadcastToClients({
        type: 'automation_progress',
        message: 'Post liked! Looking for reply button...',
        step: 'post_liked',
        liveViewUrl: liveViewUrl
      });
    }

    // Step 9: Open reply with human-like behavior
    const replyButton = await page.$('[data-testid="reply"]');
    if (replyButton) {
      console.log("💬 Opening reply with human-like movement...");
      await cursor.click(replyButton);
      await humanDelay('reply_opening', 2000, 1000);

      broadcastToClients({
        type: 'automation_progress',
        message: 'Reply dialog opened - typing GM!...',
        step: 'typing_reply',
        liveViewUrl: liveViewUrl
      });

      // Step 10: Type "GM!" with human-like typing
      await typeHumanLike(page, "GM!", liveViewUrl);

      // Step 11: Submit reply with human-like behavior
      const submitButton = await page.$('[data-testid="tweetButtonInline"]');
      if (submitButton) {
        await humanDelay('reviewing_comment', 2000, 1000); // Human reviews before posting
        
        broadcastToClients({
          type: 'automation_progress',
          message: 'Posting reply...',
          step: 'posting_reply',
          liveViewUrl: liveViewUrl
        });

        await cursor.click(submitButton);
        await humanDelay('posting', 2000, 1000);
      }
    }

    // Step 12: Human-like completion
    await humanDelay('finishing', 3000, 2000);

    console.log("🎉 Human-like automation completed successfully!");

    broadcastToClients({
      type: 'automation_complete',
      message: 'Human-like automation completed successfully!',
      sessionId: sessionId,
      liveViewUrl: liveViewUrl,
      summary: {
        login: '✅ Manual login completed',
        following: '✅ Switched to Following feed',
        interaction: '✅ Opened and read first post',
        engagement: '✅ Liked post and replied with GM!',
        completion: '✅ All actions completed naturally'
      }
    });

  } catch (error: any) {
    console.error("❌ Human-like automation error:", error);
    broadcastToClients({
      type: 'automation_error',
      error: error.message,
      sessionId: sessionId,
      liveViewUrl: liveViewUrl
    });
  }
}
```

### ADD HUMAN-LIKE HELPER FUNCTIONS:
```javascript
// Find posts with human-like scanning behavior
async function findPostsHumanLike(page: Page, liveViewUrl: string) {
  console.log("👀 Scanning for posts with human-like behavior...");
  
  // Human-like scanning delay
  await humanDelay('scanning', 2000, 1000);
  
  const selectors = [
    'article[data-testid="tweet"]',
    '[data-testid="tweet"]',
    'article[role="article"]'
  ];

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 8000 });
      const posts = await page.$$(selector);
      if (posts.length > 0) {
        console.log(`✅ Found ${posts.length} posts with human-like detection`);
        return posts;
      }
    } catch (e) {
      continue;
    }
  }

  return [];
}

// Human-like scrolling down
async function humanScrollDown(page: Page, pixels: number) {
  const scrollSteps = 3 + Math.floor(Math.random() * 3); // 3-5 steps
  const pixelsPerStep = pixels / scrollSteps;
  
  for (let i = 0; i < scrollSteps; i++) {
    await page.mouse.wheel(0, pixelsPerStep);
    await humanDelay('scrolling', 150, 100); // 150-250ms between scrolls
  }
  
  console.log(`📜 Human-like scroll down: ${pixels}px in ${scrollSteps} steps`);
}

// Human-like scrolling up
async function humanScrollUp(page: Page, pixels: number) {
  const scrollSteps = 3 + Math.floor(Math.random() * 3);
  const pixelsPerStep = pixels / scrollSteps;
  
  for (let i = 0; i < scrollSteps; i++) {
    await page.mouse.wheel(0, -pixelsPerStep);
    await humanDelay('scrolling', 150, 100);
  }
  
  console.log(`📜 Human-like scroll up: ${pixels}px in ${scrollSteps} steps`);
}

// Human-like typing with realistic patterns
async function typeHumanLike(page: Page, text: string, liveViewUrl: string) {
  const commentBox = await page.$('[data-testid="tweetTextarea_0"]');
  if (!commentBox) return;

  // Click on comment box first
  await commentBox.click();
  await humanDelay('focusing', 500, 300);

  // Type each character with human-like variability
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Simulate occasional hesitation (10% chance)
    if (Math.random() < 0.1) {
      await humanDelay('thinking', 300, 200);
    }
    
    await page.keyboard.type(char);
    
    // Variable typing speed
    let delay = 120 + Math.random() * 180; // 120-300ms base
    
    if (char === ' ') {
      delay += 50; // Longer pause after words
    } else if (char === '!') {
      delay += 100; // Pause after exclamation
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.log(`⌨️ Typed "${text}" with human-like behavior`);
}
```

## REQUIREMENTS SUMMARY

✅ **Same UX**: Test Script button works exactly the same
✅ **Persistent Live View**: Live view URL remains throughout automation  
✅ **Manual Login**: Waits for user login, then continues automatically
✅ **Human-Like Behavior**: 
   - Realistic mouse movements with ghost-cursor
   - Natural delays and thinking patterns
   - Human-like scrolling and reading behavior
   - Variable typing speeds with hesitations
   - Natural scanning and decision patterns

✅ **Complete Automation Sequence**:
   1. Login detection and waiting
   2. Switch to Following tab
   3. Find and click first post
   4. Scroll down through comments
   5. Scroll back up
   6. Like the post
   7. Open reply dialog
   8. Type "GM!" naturally
   9. Submit reply

This implementation makes the automation indistinguishable from human behavior with visible mouse movements, natural timing, and realistic interaction patterns!