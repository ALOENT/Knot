import { Request, Response } from 'express';
import { prisma } from '../utils/db';

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

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide a valid search query' });
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
        email: includeEmail,
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

    if (cursor) {
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
        email: includeEmail,
        profilePic: true,
        isOnline: true,
        lastSeen: true,
      },
      orderBy: {
        id: 'asc'
      },
      take,
      skip: cursor ? undefined : skip
    });

    const hasMore = users.length === take;
    const nextCursor = hasMore && users.length > 0 ? users[users.length - 1].id : undefined;

    const total = await prisma.user.count({ where: whereClause });

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
