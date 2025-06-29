import { Router } from "express";
import { z } from "zod";
import { automations, automationActions, browserSessions, type Automation, type InsertAutomation } from "@shared/schema";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// Get user by wallet address helper
async function getUserByWallet(walletAddress: string) {
  const { users } = await import("@shared/schema");
  const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
  return user;
}

// Authentication middleware
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

// GET /api/automations - List user automations
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const userAutomations = await db
      .select()
      .from(automations)
      .where(eq(automations.userId, req.user.id))
      .orderBy(desc(automations.createdAt));

    res.json({
      success: true,
      automations: userAutomations
    });
  } catch (error) {
    console.error('Get automations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch automations'
    });
  }
});

// POST /api/automations - Create new automation
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const automationData = z.object({
      name: z.string().min(1, 'Name is required'),
      targetKeywords: z.array(z.string()).optional(),
      targetAccounts: z.array(z.string()).optional(),
      replyStyle: z.string().optional(),
      customInstructions: z.string().optional(),
      dailyLimit: z.number().min(1).max(1000).default(50),
      activeHours: z.string().optional(),
      stealthSettings: z.string().optional(),
    }).parse(req.body);

    const [newAutomation] = await db
      .insert(automations)
      .values({
        ...automationData,
        userId: req.user.id,
        status: 'draft',
      })
      .returning();

    res.json({
      success: true,
      automation: newAutomation,
      message: 'Automation created successfully'
    });
  } catch (error) {
    console.error('Create automation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create automation'
    });
  }
});

// GET /api/automations/[id] - Get automation details
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const automationId = parseInt(req.params.id);
    
    const [automation] = await db
      .select()
      .from(automations)
      .where(and(
        eq(automations.id, automationId),
        eq(automations.userId, req.user.id)
      ));

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    // Get recent actions
    const recentActions = await db
      .select()
      .from(automationActions)
      .where(eq(automationActions.automationId, automationId))
      .orderBy(desc(automationActions.createdAt))
      .limit(10);

    res.json({
      success: true,
      automation: {
        ...automation,
        recentActions
      }
    });
  } catch (error) {
    console.error('Get automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch automation'
    });
  }
});

// PUT /api/automations/[id] - Update automation
router.put('/:id', requireAuth, async (req: any, res) => {
  try {
    const automationId = parseInt(req.params.id);
    
    const updateData = z.object({
      name: z.string().min(1).optional(),
      targetKeywords: z.array(z.string()).optional(),
      targetAccounts: z.array(z.string()).optional(),
      replyStyle: z.string().optional(),
      customInstructions: z.string().optional(),
      dailyLimit: z.number().min(1).max(1000).optional(),
      activeHours: z.string().optional(),
      stealthSettings: z.string().optional(),
    }).parse(req.body);

    const [updatedAutomation] = await db
      .update(automations)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(and(
        eq(automations.id, automationId),
        eq(automations.userId, req.user.id)
      ))
      .returning();

    if (!updatedAutomation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    res.json({
      success: true,
      automation: updatedAutomation,
      message: 'Automation updated successfully'
    });
  } catch (error) {
    console.error('Update automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update automation'
    });
  }
});

// DELETE /api/automations/[id] - Delete automation
router.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const automationId = parseInt(req.params.id);
    
    const [deletedAutomation] = await db
      .delete(automations)
      .where(and(
        eq(automations.id, automationId),
        eq(automations.userId, req.user.id)
      ))
      .returning();

    if (!deletedAutomation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    res.json({
      success: true,
      message: 'Automation deleted successfully'
    });
  } catch (error) {
    console.error('Delete automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete automation'
    });
  }
});

// POST /api/automations/[id]/start - Start automation
router.post('/:id/start', requireAuth, async (req: any, res) => {
  try {
    const automationId = parseInt(req.params.id);
    
    const [updatedAutomation] = await db
      .update(automations)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(and(
        eq(automations.id, automationId),
        eq(automations.userId, req.user.id)
      ))
      .returning();

    if (!updatedAutomation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    // TODO: Integrate with browser automation service
    
    res.json({
      success: true,
      automation: updatedAutomation,
      message: 'Automation started successfully'
    });
  } catch (error) {
    console.error('Start automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start automation'
    });
  }
});

// POST /api/automations/[id]/stop - Stop automation
router.post('/:id/stop', requireAuth, async (req: any, res) => {
  try {
    const automationId = parseInt(req.params.id);
    
    const [updatedAutomation] = await db
      .update(automations)
      .set({
        status: 'stopped',
        updatedAt: new Date(),
      })
      .where(and(
        eq(automations.id, automationId),
        eq(automations.userId, req.user.id)
      ))
      .returning();

    if (!updatedAutomation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    // TODO: Stop browser automation service
    
    res.json({
      success: true,
      automation: updatedAutomation,
      message: 'Automation stopped successfully'
    });
  } catch (error) {
    console.error('Stop automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop automation'
    });
  }
});

export { router as automationRoutes };