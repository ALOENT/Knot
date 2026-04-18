import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/db';
import { logger } from '../utils/logger';

/**
 * @desc    Get paginated message history between authenticated user and a partner
 * @route   GET /api/messages/:partnerId
 * @access  Private
 */
export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const partnerId = req.params.partnerId as string;
    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'Partner ID is required' });
    }

    // Pagination: default 50, max 100
    const take = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
    const cursor = req.query.cursor as string | undefined;

    const whereClause: any = {
      isDeleted: false,
      OR: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    };

    // Cursor-based pagination for older messages
    if (cursor) {
      whereClause.timestamp = { lt: new Date(cursor) };
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' },
      take,
      select: {
        id: true,
        content: true,
        fileUrl: true,
        senderId: true,
        receiverId: true,
        timestamp: true,
        timestamp: true,
        status: true,
        replyToId: true,
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            sender: {
              select: { username: true, displayName: true }
            }
          }
        },
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePic: true,
            isVerified: true,
          },
        },
      },
    });

    // Mark unread messages from the partner as seen (handled primarily by sockets, but fallback here)
    await prisma.message.updateMany({
      where: {
        senderId: partnerId,
        receiverId: userId,
        status: { in: ['SENT', 'DELIVERED'] },
      },
      data: { status: 'READ' },
    });

    res.status(200).json({
      success: true,
      messages,
      pagination: {
        count: messages.length,
        hasMore: messages.length === take,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch messages', error);
    next(error);
  }
};

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Lean query: find users who have sent/received messages with currentUser limit using relations
    const partners = await prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { sentMessages: { some: { receiverId: userId, isDeleted: false } } },
          { receivedMessages: { some: { senderId: userId, isDeleted: false } } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePic: true,
        isOnline: true,
        isVerified: true,
      },
    });

    const conversations = await Promise.all(
      partners.map(async (partner) => {
        const [lastMessage, unreadCount] = await Promise.all([
          prisma.message.findFirst({
            where: {
              isDeleted: false,
              OR: [
                { senderId: userId, receiverId: partner.id },
                { senderId: partner.id, receiverId: userId },
              ],
            },
            orderBy: { timestamp: 'desc' },
            select: {
              content: true,
              fileUrl: true,
              timestamp: true,
              senderId: true,
            },
          }),
          prisma.message.count({
            where: {
              senderId: partner.id,
              receiverId: userId,
              status: { in: ['SENT', 'DELIVERED'] },
              isDeleted: false,
            },
          }),
        ]);

        return {
          id: partner.id,
          username: partner.username,
          displayName: partner.displayName,
          profilePic: partner.profilePic,
          isOnline: partner.isOnline,
          isVerified: partner.isVerified,
          lastMessage: lastMessage?.content || (lastMessage?.fileUrl ? '📎 Attachment' : null),
          lastMessageTime: lastMessage?.timestamp?.toISOString() || null,
          unreadCount,
        };
      })
    );

    // Sort by last message time (newest first)
    const filtered = conversations
      .sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });

    res.status(200).json({ success: true, conversations: filtered });
  } catch (error) {
    logger.error('Failed to fetch conversations', error);
    next(error);
  }
};

/**
 * @desc    Mark all messages from a partner as read
 * @route   PUT /api/messages/mark-read/:partnerId
 * @access  Private
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const partnerId = req.params.partnerId as string;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'Partner ID is required' });
    }

    await prisma.message.updateMany({
      where: {
        senderId: partnerId,
        receiverId: userId,
        status: { in: ['SENT', 'DELIVERED'] },
      },
      data: { status: 'READ' },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to mark as read', error);
    next(error);
  }
};

/**
 * @desc    Soft delete a message sent by the user
 * @route   DELETE /api/messages/:messageId
 * @access  Private
 */
export const deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const messageId = req.params.messageId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the sender can delete this message' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true },
    });

    res.status(200).json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete message', error);
    next(error);
  }
};
