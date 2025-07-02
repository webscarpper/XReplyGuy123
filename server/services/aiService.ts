
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
