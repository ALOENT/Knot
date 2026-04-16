import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { z } from 'zod';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdminUser = (req as any).user?.role === 'ADMIN';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const search = req.query.search as string || '';
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: isAdminUser,
          username: true,
          displayName: true,
          profilePic: true,
          isOnline: true,
          role: true,
          isVerified: true,
          isBanned: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where })
    ]);

    const totalAgents = await prisma.user.count({ where: { role: 'ADMIN' } });
    const conversations = await prisma.message.groupBy({ by: ['senderId', 'receiverId'] });
    const activeConversations = conversations.length;
    const bannedEntities = await prisma.user.count({ where: { isBanned: true } });

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total: totalUsers,
          page,
          limit,
          totalPages: Math.ceil(totalUsers / limit)
        },
        stats: {
          totalAgents,
          activeConversations,
          bannedEntities,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateStatusSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
    isBanned: z.boolean().optional(),
    isVerified: z.boolean().optional(),
  }),
});

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    updateStatusSchema.parse(req);

    const { userId, isBanned, isVerified } = req.body;

    const data: any = {};
    if (typeof isBanned !== 'undefined') data.isBanned = isBanned;
    if (typeof isVerified !== 'undefined') data.isVerified = isVerified;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (data.isBanned && user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Cannot ban an admin' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        role: true,
        isBanned: true,
        isVerified: true,
      }
    });

    res.status(200).json({ success: true, data: updatedUser, message: 'Status updated successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all reports
 * @route   GET /api/admin/reports
 * @access  Private/Admin
 */
export const getReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: {
          select: { id: true, username: true, displayName: true, profilePic: true }
        },
        reportedUser: {
          select: { id: true, username: true, displayName: true, profilePic: true }
        }
      },
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' }
      ]
    });

    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resolve a report
 * @route   PUT /api/admin/reports/:id/resolve
 * @access  Private/Admin
 */
export const resolveReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid report ID format' });
    }

    // Check if report exists
    const existingReport = await prisma.report.findUnique({ where: { id } });
    if (!existingReport) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = await prisma.report.update({
      where: { id },
      data: { status: 'RESOLVED' }
    });

    res.status(200).json({ success: true, data: report, message: 'Report resolved' });
  } catch (error) {
    next(error);
  }
};
