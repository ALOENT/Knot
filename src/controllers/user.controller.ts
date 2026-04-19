import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { z } from 'zod';

const idSchema = z.string().uuid('Invalid ID format');
const updateProfileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  displayName: z.string().max(50, 'Display name too long').nullable().optional(),
  bio: z.string().max(160, 'Bio too long').nullable().optional(),
  profilePic: z.string().url('Invalid URL').nullable().optional(),
});

const isAdminUser = (user: any): boolean => {
  return user?.role === 'ADMIN';
};

/**
 * @desc    Search users by username or email
 * @route   GET /api/users/search?query=...
 * @access  Private
 */
export const searchUsers = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { query } = req.query;

    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.status(400).json({ success: false, message: 'Please provide at least 2 characters to search' });
    }

    const includeEmail = isAdminUser(req.user);

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' as const } },
          ...(includeEmail ? [{ email: { contains: query, mode: 'insensitive' as const } }] : [])
        ],
        id: { not: req.user.id }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: includeEmail,
        profilePic: true,
        isOnline: true,
        lastSeen: true,
        bio: true,
        isVerified: true,
      },
      take: 20
    });

    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while searching users' });
  }
};

/**
 * @desc    Get all system users (Fallback approach to behave as Contacts)
 * @route   GET /api/users
 * @access  Private
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const includeEmail = isAdminUser(req.user);

    const take = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
    const skip = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const cursor = req.query.cursor as string | undefined;

    const whereClause: any = {
      id: { not: req.user.id }
    };

    if (cursor && idSchema.safeParse(cursor).success) {
      whereClause.id = {
        ...whereClause.id,
        gt: cursor
      };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: includeEmail,
        profilePic: true,
        isOnline: true,
        lastSeen: true,
        isVerified: true,
      },
      orderBy: {
        id: 'asc'
      },
      take,
      skip: (cursor && idSchema.safeParse(cursor).success) ? undefined : skip
    });

    const hasMore = users.length === take;
    const nextCursor = hasMore && users.length > 0 ? users[users.length - 1].id : undefined;

    const countWhere = { id: { not: req.user.id } };
    const total = await prisma.user.count({ where: countWhere });

    res.status(200).json({ 
      success: true, 
      users,
      pagination: {
        total,
        limit: take,
        offset: skip,
        cursor: cursor || null,
        hasMore,
        nextCursor
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching contacts' });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, message: validation.error.issues[0].message });
    }

    const { username, displayName, bio, profilePic } = validation.data;
    
    // Check if username is already taken by someone else
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          id: { not: req.user.id }
        }
      });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Username is already taken' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(username && { username }),
        ...(displayName !== undefined && { displayName: displayName === '' ? null : displayName }),
        ...(bio !== undefined && { bio: bio === '' ? null : bio }),
        ...(profilePic !== undefined && { profilePic: profilePic === '' ? null : profilePic }),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        profilePic: true,
        bio: true,
        isOnline: true,
        role: true,
        isVerified: true,
        privacySettings: true
      }
    });

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while updating profile' });
  }
};

/**
 * @desc    Get user profile (public fields only)
 * @route   GET /api/users/:userId
 * @access  Private
 */
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userId = req.params.userId as string;

    // Check for block (Bidirectional)
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.user.id, blockedId: userId },
          { blockerId: userId, blockedId: req.user.id }
        ]
      }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profilePic: true,
        banner: true,
        isOnline: true,
        lastSeen: true,
        isVerified: true,
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Redact info if blocked
    if (block) {
      user.profilePic = null;
      user.bio = null;
      user.banner = null;
      user.isOnline = false;
      user.lastSeen = null; // Fix: use null for never seen (Issue 6)
    }

    return res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching profile' });
  }
};

/**
 * @desc    Block a user
 * @route   POST /api/users/block/:userId
 * @access  Private
 */
export const blockUser = async (req: Request, res: Response) => {
  try {
    const blockerId = req.user?.id;
    const blockedId = req.params.userId as string;

    if (!blockerId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (blockerId === blockedId) return res.status(400).json({ success: false, message: 'Cannot block yourself' });

    await prisma.block.upsert({
      where: {
        blockerId_blockedId: { blockerId, blockedId }
      },
      update: {},
      create: { blockerId, blockedId }
    });

    res.status(200).json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to block user' });
  }
};

/**
 * @desc    Unblock a user
 * @route   DELETE /api/users/block/:userId
 * @access  Private
 */
export const unblockUser = async (req: Request, res: Response) => {
  try {
    const blockerId = req.user?.id;
    const blockedId = req.params.userId as string;

    if (!blockerId) return res.status(401).json({ success: false, message: 'Authentication required' });

    await prisma.block.deleteMany({
      where: { blockerId, blockedId }
    });

    res.status(200).json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
};

/**
 * @desc    Get blocked users
 * @route   GET /api/users/blocked
 * @access  Private
 */
/**
 * @desc    Get bidirectional blocks for the current user
 * @route   GET /api/users/blocked
 * @access  Private
 */
export const getBlockedUsers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    // Users I have blocked
    const blocked = await prisma.block.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePic: true,
          }
        }
      }
    });

    // Users who have blocked me
    const blockedBy = await prisma.block.findMany({
      where: { blockedId: userId },
      select: { blockerId: true }
    });

    res.status(200).json({ 
      success: true, 
      blockedUsers: blocked.map(b => b.blocked),
      blockedByIDs: blockedBy.map(b => b.blockerId)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch blocked users' });
  }
};

/**
 * @desc    Get undismissed warnings for the current user
 * @route   GET /api/users/warnings
 * @access  Private
 */
export const getWarnings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const warnings = await prisma.warning.findMany({
      where: { userId, isDismissed: false },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json({ success: true, warnings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch warnings' });
  }
};

/**
 * @desc    Dismiss a warning
 * @route   PUT /api/users/warnings/:id/dismiss
 * @access  Private
 */
export const dismissWarning = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const warningId = req.params.id as string;
    
    // Validate ID (Issue 7)
    try {
      idSchema.parse(warningId);
    } catch (e: any) {
      return res.status(400).json({ success: false, message: e.message || 'Invalid warning ID' });
    }

    // Ownership-safe update using updateMany
    const updateResult = await prisma.warning.updateMany({
      where: { 
        id: warningId, 
        userId,
        isDismissed: false
      },
      data: { isDismissed: true }
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ success: false, message: 'Warning not found or already dismissed' });
    }

    res.status(200).json({ success: true, message: 'Warning dismissed' });
  } catch (error: any) {
    logger.error('Error dismissing warning:', error);
    res.status(500).json({ success: false, message: 'Failed to dismiss warning' });
  }
};
