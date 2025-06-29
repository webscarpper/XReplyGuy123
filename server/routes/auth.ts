import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertUserSchema } from '@shared/schema';

const router = Router();

// Validate wallet and invitation code
router.post('/validate', async (req, res) => {
  try {
    const { walletAddress, invitationCode } = z.object({
      walletAddress: z.string().min(32, 'Invalid wallet address'),
      invitationCode: z.string().min(1, 'Invitation code required'),
    }).parse(req.body);

    // Check if invitation code is valid and unused
    const inviteCode = await storage.getInvitationCode(invitationCode);
    if (!inviteCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid invitation code' 
      });
    }

    if (inviteCode.isUsed) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invitation code has already been used' 
      });
    }

    // Check if user already exists
    const existingUser = await storage.getUserByWalletAddress(walletAddress);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address already registered' 
      });
    }

    // Create new user
    const newUser = await storage.createUser({
      walletAddress,
      invitationCode,
      tier: inviteCode.tier,
      actionsPerDay: inviteCode.actionsPerDay,
    });

    // Mark invitation code as used
    await storage.markInvitationCodeAsUsed(invitationCode, newUser.id);

    res.json({
      success: true,
      user: {
        id: newUser.id,
        walletAddress: newUser.walletAddress,
        tier: newUser.tier,
        actionsPerDay: newUser.actionsPerDay,
      },
      message: 'Access granted! Welcome to XReplyGuy.'
    });

  } catch (error) {
    console.error('Auth validation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: error.errors[0].message 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Login with just wallet address (for existing users)
router.post('/login', async (req, res) => {
  try {
    const { walletAddress } = z.object({
      walletAddress: z.string().min(32, 'Invalid wallet address'),
    }).parse(req.body);

    const user = await storage.getUserByWalletAddress(walletAddress);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found. Please register with an invitation code.' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is inactive. Please contact support.' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        tier: user.tier,
        actionsPerDay: user.actionsPerDay,
      },
      message: 'Welcome back to XReplyGuy!'
    });

  } catch (error) {
    console.error('Auth login error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        message: error.errors[0].message 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

export { router as authRoutes };