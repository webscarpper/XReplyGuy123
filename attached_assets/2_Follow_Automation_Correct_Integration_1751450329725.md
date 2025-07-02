# 2. Follow Automation - CORRECT Integration After YouTube

## 📋 Overview
This guide adds follow automation **AT THE END** of the current automation flow, **AFTER** the YouTube browsing phase completes. No function placement confusion - everything goes where it logically belongs.

## 🎯 **CORRECT AUTOMATION SEQUENCE**
Login → Following → First Post → Like → AI Reply → YouTube → **THEN ADD** → Follow Automation → Profile Visit → Second Post → Like → AI Reply

## 🚀 Implementation Steps

### Step 1: Add Follow Automation Functions AT THE END

**Location**: Add to `server/routes/test-browser.ts` **AT THE END OF THE FILE** before the export statement

**Replit AI Agent Prompt**:
```
Add these two new functions to the END of server/routes/test-browser.ts file, just before the export statement at the bottom of the file.

Add these complete functions:

```typescript
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
    await humanDelay(page, 1000, 3000);
    
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
    const postContent = await extractPostContent(secondPost);
    
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
      
      const replyText = await AIReplyService.generateReply(postContent, 'supportive');
      
      console.log('💬 AI Generated Reply for profile post:', replyText);
      
      broadcastToClients({
        type: 'automation_progress',
        message: `AI generated reply for @${username}'s post: "${replyText.substring(0, 50)}..."`,
        step: 'ai_reply_generated_profile',
        liveViewUrl: liveViewUrl
      });
      
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
        await typeHumanLike(page, replyText);
        
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
async function extractPostContent(postElement: any): Promise<string> {
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
```

These functions are added at the END of the file where they belong in the automation flow.
```

### Step 2: Integrate Follow Automation AFTER YouTube Phase

**Location**: Find where YouTube browsing completes in the automation flow

**Replit AI Agent Prompt**:
```
In the performVerifiedAutomation function in server/routes/test-browser.ts, find where the YouTube browsing completes.

Look for this code:
```typescript
        // Call YouTube browsing function AFTER reply completion
        await openYouTubeAndScroll(page, sessionId);

        broadcastToClients({
          type: 'automation_progress',
          message: 'Returned from YouTube browsing. Automation cycle complete!',
          step: 'youtube_complete',
          liveViewUrl: liveViewUrl
        });
```

REPLACE the "Automation cycle complete" section with this follow automation integration:
```typescript
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
        await humanDelay(page, 3000, 6000);
        
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
          type: 'automation_progress',
          message: 'Complete automation cycle finished! Session remains active.',
          step: 'full_cycle_complete',
          liveViewUrl: liveViewUrl
        });
```

This adds the follow automation AFTER YouTube browsing completes, exactly where it belongs in the flow.
```

## ✅ **CORRECT IMPLEMENTATION SUMMARY**

1. **Functions added AT THE END** of the file (where they belong)
2. **Integration happens AFTER YouTube** (correct sequence)
3. **No confusion about placement** - everything goes where it logically fits
4. **Complete automation flow** from start to finish

**FINAL SEQUENCE**: Login → Following → First Post → Like → AI Reply → YouTube → Follow Automation → Profile Visit → Second Post → Like → AI Reply → END

---

**Implementation Status**: Ready for Replit AI Agent
**Estimated Time**: 15-20 minutes
**Complexity**: Medium
**Risk Level**: Low (comprehensive error handling)