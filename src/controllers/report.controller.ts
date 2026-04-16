import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * @desc    Create a new report for a user
 * @route   POST /api/reports
 * @access  Private
 */
export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reporterId = req.user?.id;
    const { reportedUserId, reason } = req.body;

    if (!reporterId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

    if (!reportedUserId || !trimmedReason) {
      return res.status(400).json({ success: false, message: 'Reported user ID and non-empty reason are required' });
    }

    if (trimmedReason.length > 500) {
      return res.status(400).json({ success: false, message: 'Reason cannot exceed 500 characters' });
    }

    // Prevent reporting self
    if (reporterId === reportedUserId) {
      return res.status(400).json({ success: false, message: 'You cannot report yourself' });
    }

    // Check if reported user exists
    const reportedUser = await prisma.user.findUnique({ where: { id: reportedUserId } });
    if (!reportedUser) {
      return res.status(404).json({ success: false, message: 'Reported user not found' });
    }

    // Fetch last 15 messages for context
    const contextMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: reporterId, receiverId: reportedUserId },
          { senderId: reportedUserId, receiverId: reporterId },
        ],
      },
      orderBy: { timestamp: 'desc' },
      take: 15,
      select: {
        id: true,
        content: true,
        senderId: true,
        timestamp: true,
      },
    });

    // Create the report
    const report = await prisma.report.create({
      data: {
        reporterId,
        reportedUserId,
        reason: trimmedReason,
        contextMessages: contextMessages, // Snapshot
      },
    });

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to create report', error);
    next(error);
  }
};
