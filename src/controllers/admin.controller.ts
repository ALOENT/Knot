import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { z } from 'zod';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdminUser = (req as any).user?.role === 'ADMIN';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
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
      prisma.user.count()
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

    // Build data object dynamically based on provided fields
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

    // If banned, we might invalidate session somehow here, 
    // but the next API call will fail if the middleware checks for isBanned.
    // For now, the prompt specifies restricting login, which we did.

    res.status(200).json({ success: true, data: updatedUser, message: 'Status updated successfully' });
  } catch (error) {
    next(error);
  }
};
