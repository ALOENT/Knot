import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { z } from 'zod';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
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
    });

    const totalAgents = users.filter(u => u.role === 'ADMIN').length;
    const activeConversations = await prisma.message.count(); // Approximation or different logic if needed
    const bannedEntities = users.filter(u => u.isBanned).length;

    res.status(200).json({
      success: true,
      data: {
        users,
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

    // You cannot ban an ADMIN (safety mechanism)
    if (data.isBanned) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.role === 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Cannot ban an admin' });
        }
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
