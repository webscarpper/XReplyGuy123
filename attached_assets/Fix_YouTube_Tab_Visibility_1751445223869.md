# Fix YouTube Tab Visibility in Live View

## 🚨 Problem Identified
The YouTube tab opens successfully but is not visible because:
- YouTube opens in background tab of remote Browserbase session
- Live view iframe only shows the active X tab
- Each tab has its own unique live view URL that needs to be retrieved

## 📋 Solution: Get YouTube Tab Live View URL

Based on official Browserbase documentation, we need to:
1. Get all tab live view URLs after YouTube tab opens
2. Broadcast the YouTube tab's specific live view URL
3. Frontend can show both tabs or switch between them

## 🎯 Implementation Fix

### Step 1: Update YouTube Function to Get Live View URL

Replace the existing `openYouTubeAndScroll` function with this enhanced version:

```javascript
// Human-like YouTube browsing simulation with live view URL
async function openYouTubeAndScroll(page, sessionId) {
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
        
        // Broadcast YouTube tab live view URL
        broadcastToClients({
          type: 'youtube_tab_opened',
          message: 'YouTube tab opened - you can now see it!',
          youtubeTabUrl: youtubeTabLiveView.debuggerFullscreenUrl,
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
      type: 'youtube_tab_closing',
      message: 'Closing YouTube tab, returning to X...'
    });
    
    // Close the YouTube tab
    await youtubeTab.close();
    console.log("✅ YouTube tab closed, returning to X");
    
    // Small delay before continuing
    await page.waitForTimeout(1000 + Math.random() * 2000);
    
  } catch (error) {
    console.error("❌ YouTube tab error:", error.message);
    // Don't throw - continue automation even if YouTube fails
  }
}
```

### Step 2: Add Browserbase Import (if not already present)

At the top of the file, ensure you have the Browserbase import:

```javascript
import { Browserbase } from "@browserbasehq/sdk";
```

### Step 3: Update Frontend to Handle YouTube Tab (Optional)

In the frontend WebSocket handler, add support for YouTube tab messages:

```javascript
case 'youtube_tab_opened':
  console.log('🎥 YouTube tab opened:', data.youtubeTabUrl);
  console.log('📺 All tabs:', data.allTabs);
  
  // Option 1: Show YouTube URL in console for manual viewing
  console.log('YouTube Live View URL:', data.youtubeTabUrl);
  
  // Option 2: Could create second iframe for YouTube tab
  // setYoutubeTabUrl(data.youtubeTabUrl);
  
  break;

case 'youtube_tab_closing':
  console.log('🔄 YouTube tab closing, returning to X');
  break;
```

## ✅ Expected Result

After this fix:

1. **Console Logs**: Will show YouTube tab live view URL
2. **WebSocket Messages**: Frontend receives YouTube tab URL
3. **Visibility Options**: 
   - Copy YouTube live view URL from console to view in separate browser tab
   - Frontend could display both X and YouTube tabs simultaneously
   - Or switch between tabs programmatically

## 🎯 Technical Explanation

**Why This Works**:
- Uses official Browserbase `sessions.debug()` API
- Gets `pages` array with all tab live view URLs
- Each tab has unique `debuggerFullscreenUrl`
- Finds YouTube tab by URL matching
- Broadcasts URL for frontend handling

**Official API Used**:
```javascript
// From Browserbase documentation
const liveViewLinks = await bb.sessions.debug(session.id);
const allTabs = liveViewLinks.pages;
const youtubeTabUrl = allTabs[1].debuggerFullscreenUrl; // Second tab
```

## 🚨 Important Notes

1. **Browserbase Import**: Ensure Browserbase SDK is imported
2. **Session ID**: Must pass correct sessionId to the function
3. **API Key**: Uses same BROWSERBASE_API_KEY from environment
4. **Error Handling**: Won't break automation if live view URL fails
5. **Frontend Integration**: Optional - can view YouTube URL manually

This fix makes the YouTube tab visible and provides the foundation for multi-tab live view management!