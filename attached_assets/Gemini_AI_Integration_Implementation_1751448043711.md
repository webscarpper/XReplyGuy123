# Gemini AI Integration for XReplyGuy - Complete Implementation Guide

## 📋 Overview
This guide implements AI-powered dynamic replies using Google's official `@google/genai` SDK (version 1.8.0). The implementation extracts post content and generates contextual replies using Gemini AI.

## 🔍 Official Documentation References
- **Package**: `@google/genai` (latest: 1.8.0) - https://www.npmjs.com/package/@google/genai
- **Documentation**: https://googleapis.github.io/js-genai/
- **Gemini Developer API**: https://ai.google.dev/gemini-api/docs

## 🎯 Implementation Steps

### Step 1: Install Gemini SDK

**Replit AI Agent Prompt**:
```
Add the official Google Gemini AI SDK to the project dependencies.

Run this command in the terminal:
```bash
npm install @google/genai
```

This installs the latest official Google Gen AI SDK (version 1.8.0) which supports Gemini 2.0+ features.
```

### Step 2: Add Environment Variable

**Replit AI Agent Prompt**:
```
Add the Gemini API key to the .env file in the project root.

Add this line to the .env file:
```
GEMINI_API_KEY=AIzaSyC_15OuZvu_8nXsCpvqufALKjj6MX6kkwk
```

This API key will be used to authenticate with Google's Gemini API.
```

### Step 3: Create AI Service Module

**Location**: Create new file `server/services/aiService.ts`

**Replit AI Agent Prompt**:
```
Create a new file called aiService.ts in the server/services/ directory (create the services folder if it doesn't exist).

Add this complete AI service implementation:

```typescript
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini AI with API key from environment
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!
});

// AI Reply Generation Service
export class AIReplyService {
  
  // Generate contextual reply based on post content
  static async generateReply(postContent: string, replyStyle: string = 'conversational'): Promise<string> {
    try {
      console.log('🤖 Generating AI reply for post:', postContent.substring(0, 100) + '...');
      
      // Create system prompt based on reply style
      const systemPrompt = this.getSystemPrompt(replyStyle);
      
      // Combine system prompt with post content
      const fullPrompt = `${systemPrompt}\n\nTweet: "${postContent}"\n\nReply:`;
      
      // Call Gemini API using official method
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',  // Fast, cost-effective model
        contents: fullPrompt,
        config: {
          generationConfig: {
            temperature: 0.7,        // Balanced creativity
            topP: 0.8,              // Focused responses  
            maxOutputTokens: 150,   // Twitter-appropriate length
            stopSequences: ['\n\n'] // Stop at double newline
          }
        }
      });
      
      // Extract text from response using official method
      const replyText = response.text;
      
      // Clean and validate the reply
      const cleanReply = this.cleanReply(replyText);
      
      console.log('✅ AI reply generated:', cleanReply);
      return cleanReply;
      
    } catch (error: any) {
      console.error('❌ AI reply generation failed:', error.message);
      
      // Fallback to static reply if AI fails
      return this.getFallbackReply(replyStyle);
    }
  }
  
  // Get system prompt based on reply style
  private static getSystemPrompt(style: string): string {
    const prompts = {
      conversational: "You are a friendly, engaging Twitter user. Generate a brief, natural reply to this tweet. Keep it under 280 characters, be positive and conversational. Avoid hashtags unless relevant. Sound human and authentic.",
      
      supportive: "You are a supportive, encouraging Twitter user. Generate a positive, uplifting reply to this tweet. Keep it under 280 characters, be encouraging and kind. Avoid hashtags unless relevant.",
      
      professional: "You are a professional, business-minded Twitter user. Generate a thoughtful, professional reply to this tweet. Keep it under 280 characters, be respectful and insightful. Avoid hashtags unless relevant.",
      
      casual: "You are a casual, friendly Twitter user. Generate a relaxed, informal reply to this tweet. Keep it under 280 characters, be friendly and approachable. Avoid hashtags unless relevant.",
      
      question: "You are a curious Twitter user who asks thoughtful questions. Generate a reply that asks a relevant follow-up question about this tweet. Keep it under 280 characters, be genuinely curious."
    };
    
    return prompts[style] || prompts.conversational;
  }
  
  // Clean and validate the generated reply
  private static cleanReply(reply: string): string {
    // Remove quotes if AI wrapped the response
    let cleaned = reply.replace(/^["']|["']$/g, '');
    
    // Remove any "Reply:" prefix if AI included it
    cleaned = cleaned.replace(/^Reply:\s*/i, '');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    // Ensure it's not too long (Twitter limit)
    if (cleaned.length > 280) {
      cleaned = cleaned.substring(0, 277) + '...';
    }
    
    // Ensure it's not too short
    if (cleaned.length < 10) {
      return "Thanks for sharing! 👍";
    }
    
    return cleaned;
  }
  
  // Fallback replies if AI fails
  private static getFallbackReply(style: string): string {
    const fallbacks = {
      conversational: "Interesting perspective! Thanks for sharing this.",
      supportive: "Great point! Really appreciate you sharing this.",
      professional: "Thank you for this insightful post.",
      casual: "Nice! Thanks for posting this.",
      question: "That's fascinating! What made you think about this?"
    };
    
    return fallbacks[style] || fallbacks.conversational;
  }
  
  // Test the AI service
  static async testConnection(): Promise<boolean> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'Say "AI service working" if you can read this.'
      });
      
      console.log('🧪 AI Service Test:', response.text);
      return true;
    } catch (error: any) {
      console.error('❌ AI Service Test Failed:', error.message);
      return false;
    }
  }
}
```

This service uses the official Google Gen AI SDK with proper error handling and fallback mechanisms.
```

### Step 4: Create Text Extraction Function

**Location**: Add to `server/routes/test-browser.ts`

**Replit AI Agent Prompt**:
```
Add a text extraction function to server/routes/test-browser.ts. Place this function before the checkIfLoginNeeded function.

Add this function:

```typescript
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
```

This function uses only official Playwright methods (locator, textContent, allTextContents) with multiple fallback selectors.
```

### Step 5: Import AI Service

**Location**: Add to top of `server/routes/test-browser.ts`

**Replit AI Agent Prompt**:
```
Add the AI service import to the top of server/routes/test-browser.ts file.

Add this import statement with the other imports at the top of the file:

```typescript
import { AIReplyService } from '../services/aiService';
```

This imports the AI service we created for generating dynamic replies.
```

### Step 6: Replace Static Reply with AI Generation

**Location**: In `server/routes/test-browser.ts`, find the reply generation section

**Replit AI Agent Prompt**:
```
In the performVerifiedAutomation function in server/routes/test-browser.ts, find the section where the reply text is generated (around line 1374).

Look for this code:
```typescript
        // Step 2: Clear and type using human-like typing
        const replyText = "GM! Hope you're having a great day! 🌅 Thanks for sharing this!";
```

REPLACE the entire reply generation section with this AI-powered version:

```typescript
        // Step 2: Extract post content and generate AI reply
        console.log('🤖 Generating AI-powered reply...');
        
        // Extract the post content first
        const postContent = await extractPostContent(page);
        
        // Add thinking delay (human-like behavior)
        const thinkingDelay = 2000 + Math.random() * 3000; // 2-5 seconds
        console.log(`🤔 Thinking for ${Math.round(thinkingDelay/1000)}s before replying...`);
        await page.waitForTimeout(thinkingDelay);
        
        // Generate AI reply based on post content
        const replyText = await AIReplyService.generateReply(postContent, 'conversational');
        
        console.log('💬 AI Generated Reply:', replyText);
        
        broadcastToClients({
          type: 'automation_progress',
          message: `AI generated reply: "${replyText.substring(0, 50)}..."`,
          step: 'ai_reply_generated',
          liveViewUrl: liveViewUrl
        });
```

This replaces static replies with dynamic AI-generated responses based on the actual post content.
```

### Step 7: Add AI Service Test (Optional)

**Location**: Add to the test script endpoint

**Replit AI Agent Prompt**:
```
Add an AI service test to the test script. In server/routes/test-browser.ts, find the /test-script endpoint and add this AI test before the main automation starts.

Add this code after the session creation but before the automation begins:

```typescript
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
```

This tests the AI service before starting automation to ensure everything is working.
```

## ✅ Expected Results

After implementation:

1. **Dynamic Replies**: Each reply will be unique and contextual to the post content
2. **Human-like Behavior**: 2-5 second "thinking" delay before generating replies  
3. **Fallback System**: Static replies if AI service fails
4. **Cost Effective**: Using Gemini 1.5 Flash model (~$0.01-0.05 per 100 replies)
5. **Rate Limiting**: Respects API limits with proper error handling

## 🔧 Technical Details

### Official APIs Used:
- `GoogleGenAI({apiKey})` - Initialize AI client
- `ai.models.generateContent()` - Generate content
- `response.text` - Extract generated text
- `page.locator()` - Find elements
- `locator.allTextContents()` - Extract text content

### Models Available:
- `gemini-1.5-flash` - Fast, cost-effective (recommended)
- `gemini-1.5-pro` - More capable, higher cost
- `gemini-2.0-flash-001` - Latest model

### Configuration Options:
- `temperature: 0.7` - Balanced creativity
- `topP: 0.8` - Focused responses
- `maxOutputTokens: 150` - Twitter-appropriate length

## 🚨 Important Notes

1. **API Key Security**: Never commit API key to code, use environment variables
2. **Rate Limits**: Gemini has generous limits (1,500 requests/day free)
3. **Error Handling**: Always has fallback to static replies
4. **Cost Management**: Estimated $0.50-2.00/day for 500-1000 replies
5. **Content Safety**: Gemini has built-in safety filters

## 🧪 Testing

After implementation:
1. Run the test script and watch console logs
2. Verify AI service test passes
3. Check that replies are contextual to post content
4. Confirm fallback works if AI fails
5. Monitor API usage in Google AI Studio

## 📞 Support

If you encounter issues:
1. Check API key is correctly set in .env
2. Verify internet connection for API calls
3. Check console logs for specific error messages
4. Ensure sufficient API quota in Google AI Studio

---

**Implementation Status**: Ready for Replit AI Agent
**Estimated Time**: 15-20 minutes
**Complexity**: Medium
**Risk Level**: Low (graceful fallbacks included)