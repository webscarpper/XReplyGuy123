import { Router } from "express";
import { z } from "zod";
import { browserSessions } from "@shared/schema";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

const router = Router();

// Authentication middleware (reuse from automations)
async function getUserByWallet(walletAddress: string) {
  const { users } = await import("@shared/schema");
  const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
  return user;
}

async function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const walletAddress = authHeader.replace('Bearer ', '');
  const user = await getUserByWallet(walletAddress);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication'
    });
  }

  req.user = user;
  next();
}

// POST /api/bright-data/session - Create browser session
router.post('/session', requireAuth, async (req: any, res) => {
  try {
    const sessionData = z.object({
      automationId: z.number().min(1),
    }).parse(req.body);

    // Generate unique session ID
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // TODO: Integrate with Bright Data API to create actual browser session
    const browserUrl = `https://browser-session-placeholder.com/${sessionId}`;

    const [newSession] = await db
      .insert(browserSessions)
      .values({
        automationId: sessionData.automationId,
        sessionId,
        status: 'starting',
        browserUrl,
      })
      .returning();

    res.json({
      success: true,
      session: newSession,
      message: 'Browser session created successfully'
    });
  } catch (error) {
    console.error('Create browser session error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create browser session'
    });
  }
});

// GET /api/bright-data/session/[id] - Get session status
router.get('/session/:id', requireAuth, async (req: any, res) => {
  try {
    const sessionId = req.params.id;
    
    const [session] = await db
      .select()
      .from(browserSessions)
      .where(eq(browserSessions.sessionId, sessionId));

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Browser session not found'
      });
    }

    // TODO: Check actual session status with Bright Data API
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Get browser session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch browser session'
    });
  }
});

// DELETE /api/bright-data/session/[id] - End session
router.delete('/session/:id', requireAuth, async (req: any, res) => {
  try {
    const sessionId = req.params.id;
    
    const [updatedSession] = await db
      .update(browserSessions)
      .set({
        status: 'stopped',
        endedAt: new Date(),
      })
      .where(eq(browserSessions.sessionId, sessionId))
      .returning();

    if (!updatedSession) {
      return res.status(404).json({
        success: false,
        message: 'Browser session not found'
      });
    }

    // TODO: End actual browser session with Bright Data API
    
    res.json({
      success: true,
      session: updatedSession,
      message: 'Browser session ended successfully'
    });
  } catch (error) {
    console.error('End browser session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end browser session'
    });
  }
});

export { router as browserRoutes };