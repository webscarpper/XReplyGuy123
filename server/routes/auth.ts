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

    // Check if invitation code is valid
    const inviteCode = await storage.getInvitationCode(invitationCode);
    if (!inviteCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid invitation code' 
      });
    }

    // Check if invitation code is already used
    if (inviteCode.isUsed) {
      // Code is used - check if it's being used by the same wallet address
      const existingUser = await storage.getUserByWalletAddress(walletAddress);
      
      if (existingUser && existingUser.invitationCode === invitationCode) {
        // Same wallet address using the same code - allow login
        return res.json({
          success: true,
          message: 'Welcome back! Authentication successful.',
          user: {
            id: existingUser.id,
            walletAddress: existingUser.walletAddress,
            tier: existingUser.tier,
            dailyLimit: existingUser.dailyLimit,
            usageToday: existingUser.usageToday,
            subscriptionExpires: existingUser.subscriptionExpires
          }
        });
      } else {
        // Different wallet address trying to use the code, or existing user trying different code
        return res.status(400).json({
          success: false,
          message: 'Please use the same wallet address that you first logged in with'
        });
      }
    }

    // Check if user already exists with this wallet address but different code
    const existingUser = await storage.getUserByWalletAddress(walletAddress);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please use the same wallet address that you first logged in with' 
      });
    }

    // Create new user and bind the invitation code to this wallet
    const subscriptionExpires = new Date();
    subscriptionExpires.setDate(subscriptionExpires.getDate() + 30); // 30 days from now

    const newUser = await storage.createUser({
      walletAddress,
      invitationCode,
      tier: inviteCode.tier,
      dailyLimit: inviteCode.actionsPerDay,
      usageToday: 0,
      subscriptionStartDate: new Date(),
      subscriptionExpires,
      isActive: true,
    });

    // Mark invitation code as used and bind to this user
    await storage.markInvitationCodeAsUsed(invitationCode, newUser.id);

    res.json({
      success: true,
      message: `Welcome to XReplyGuy! You have been granted ${inviteCode.tier} tier access with ${inviteCode.actionsPerDay} actions per day.`,
      user: {
        id: newUser.id,
        walletAddress: newUser.walletAddress,
        tier: newUser.tier,
        dailyLimit: newUser.dailyLimit,
        usageToday: newUser.usageToday,
        subscriptionExpires: newUser.subscriptionExpires,
      }
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
        dailyLimit: user.dailyLimit,
        usageToday: user.usageToday,
        subscriptionExpires: user.subscriptionExpires,
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

// Initialize all invitation codes
router.post('/init-codes', async (req, res) => {
  try {
    const allCodes = [
      // Free Plan (Invitation Required)
      { code: 'FR33B1X8', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33M5P2', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33K9D7', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33Z4A1', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33L6V9', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33J2S4', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33C8G3', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33R7T5', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33H1N6', tier: 'free', actionsPerDay: 20 },
      { code: 'FR33W9Q0', tier: 'free', actionsPerDay: 20 },
      
      // Starter Plan (2 SOL)
      { code: 'STRT2S4P', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT9K1J', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT5F8G', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT1M6N', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT7V3C', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT4Z8X', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT0D2H', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT6B5L', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT8R9W', tier: 'starter', actionsPerDay: 250 },
      { code: 'STRT3Q7E', tier: 'starter', actionsPerDay: 250 },
      
      // Pro Plan (3 SOL - Popular)
      { code: 'PROX3N5L', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX8J1V', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX2R7T', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX9G4H', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX5C6Z', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX1S9B', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX7K3D', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX4F8W', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX6M2P', tier: 'pro', actionsPerDay: 500 },
      { code: 'PROX0A5E', tier: 'pro', actionsPerDay: 500 },
      
      // Advanced Plan (4 SOL)
      { code: 'ADVN4B6T', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN1M9S', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN8P3J', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN5G2R', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN7H4K', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN2Z8F', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN9L6D', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN3X7V', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN0C1W', tier: 'advanced', actionsPerDay: 750 },
      { code: 'ADVN6E5Q', tier: 'advanced', actionsPerDay: 750 },
      
      // Enterprise Plan (5 SOL)
      { code: 'ENTP5R8S', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP1Z2X', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP7K9J', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP3D4F', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP8G5H', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP2M6N', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP9B7V', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP4L1C', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP6T3W', tier: 'enterprise', actionsPerDay: 1000 },
      { code: 'ENTP0Q5A', tier: 'enterprise', actionsPerDay: 1000 },
    ];

    const createdCodes = [];
    for (const codeData of allCodes) {
      try {
        // Check if code already exists
        const existingCode = await storage.getInvitationCode(codeData.code);
        if (!existingCode) {
          const newCode = await storage.createInvitationCode(codeData);
          createdCodes.push(newCode);
        }
      } catch (error) {
        // Code might already exist, continue
        console.log(`Code ${codeData.code} already exists or failed to create`);
      }
    }

    res.json({
      success: true,
      message: `Initialized ${createdCodes.length} invitation codes`,
      totalCodes: allCodes.length,
      byTier: {
        free: allCodes.filter(c => c.tier === 'free').length,
        starter: allCodes.filter(c => c.tier === 'starter').length,
        pro: allCodes.filter(c => c.tier === 'pro').length,
        advanced: allCodes.filter(c => c.tier === 'advanced').length,
        enterprise: allCodes.filter(c => c.tier === 'enterprise').length,
      }
    });

  } catch (error) {
    console.error('Init codes error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize codes' 
    });
  }
});

// Get user data for dashboard
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No valid authorization token provided'
      });
    }

    // Extract wallet address from the token (simplified for demo)
    const walletAddress = authHeader.replace('Bearer ', '');
    
    const user = await storage.getUserByWalletAddress(walletAddress);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if subscription is still valid
    const now = new Date();
    const isExpired = user.subscriptionExpires < now;
    
    // Calculate days remaining
    const daysRemaining = Math.max(0, Math.ceil((user.subscriptionExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    res.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        tier: user.tier,
        dailyLimit: user.dailyLimit,
        usageToday: user.usageToday,
        subscriptionExpires: user.subscriptionExpires,
        daysRemaining,
        isExpired,
      }
    });

  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export { router as authRoutes };