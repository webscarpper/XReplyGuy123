# Add YouTube Browsing After Reply Completion

## 📋 Implementation Instructions for Replit AI Agent

Add YouTube browsing simulation at the end of the current test script automation. This should happen AFTER the reply is successfully submitted.

## 🎯 Step 1: Add YouTube Function

Add this function at the end of the file, before the export statement:

```javascript
// Human-like YouTube browsing simulation
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

## 🎯 Step 2: Add YouTube Call After Reply Submission

Find the section where the reply is successfully submitted and verified. Look for where the automation checks if the modal closed or reply was successful.

AFTER the reply verification section, add this code:

```javascript
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
          message: 'Returned from YouTube browsing. Automation cycle complete!',
          step: 'youtube_complete',
          liveViewUrl: liveViewUrl
        });
```

## 🎯 Step 3: Update Final Completion Message

Update the final automation completion message to reflect that YouTube browsing was included:

```javascript
    broadcastToClients({
      type: 'automation_complete',
      message: 'Human-like automation cycle completed! Session remains active.',
      sessionId: sessionId,
      liveViewUrl: liveViewUrl,
      summary: {
        login: '✅ Login completed',
        navigation: '✅ Navigated to Following feed',
        interaction: '✅ Opened and read first post',
        engagement: '✅ Liked post and replied',
        browsing: '✅ YouTube browsing simulation',
        completion: '✅ Cycle complete - session active'
      }
    });
```

## ✅ Expected Result

After implementation:
1. The automation will complete the full Twitter sequence (login → following → post → like → reply)
2. Then automatically open YouTube in a new tab
3. Scroll naturally for 1600px in realistic chunks
4. Browse for 5-10 seconds
5. Close YouTube tab and return to X tab
6. X tab remains open for continued automation

This creates realistic human-like browsing behavior that helps avoid detection during long-term automation sessions.

## 🚨 Important Notes

- Add the function at the END of the file before export
- Add the YouTube call AFTER reply verification
- The X tab stays open throughout the entire process
- YouTube browsing is optional - if it fails, automation continues
- This supports long-term automation strategies (6-24 hour sessions)