import { Request, Response } from 'express';
import { prisma } from '../utils/db';

/**
 * @desc    Search users by username or email
 * @route   GET /api/users/search?query=...
 * @access  Private
 */
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid search query' });
    }

    // A simplified OR search for username or email
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ],
        // Exclude the currently logged in user from results
        id: { not: req.user?.id }
      },
      select: {
        id: true,
        username: true,
        email: true,
        profilePic: true,
        isOnline: true,
        lastSeen: true,
        bio: true,
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
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user?.id }
      },
      select: {
        id: true,
        username: true,
        email: true,
        profilePic: true,
        isOnline: true,
        lastSeen: true,
      },
      orderBy: {
        username: 'asc'
      }
    });

    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching contacts' });
  }
};
