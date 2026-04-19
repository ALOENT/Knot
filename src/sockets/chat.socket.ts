import { Server, Socket } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../utils/db';
import { logger } from '../utils/logger';
import { SOCKET_EVENTS } from '../utils/socketEvents';

const getRoomId = (userId1: string, userId2: string) => {
  return [userId1, userId2].sort().join('-');
};

export const initChatSocket = (io: Server) => {
  // Authentication Middleware
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const parsedCookies = cookie.parse(socket.request.headers.cookie || '');
      const token = parsedCookies.jwt;

      if (!token) {
        return next(new Error('Authentication error: Missing cookie'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = {
        id: user.id,
        role: user.role,
      };

      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    // If we're here, auth middleware succeeded so socket.user exists
    const userId = socket.user!.id;
    const userRole = socket.user!.role;

    logger.info(`Socket connected: ${socket.id} (User: ${userId}, Role: ${userRole})`);

    // Update presence
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: new Date() },
      });
      socket.broadcast.emit('presence_update', { userId, isOnline: true, lastSeen: new Date() });
    } catch (error) {
      logger.error('Failed to update presence on connect', error);
    }

    // Join generic user room for direct notifications
    socket.join(userId);

    // Join Chat Event
    socket.on(SOCKET_EVENTS.JOIN_CHAT, (data: { targetUserId: string }) => {
      if (!data.targetUserId) return;
      const roomId = getRoomId(userId, data.targetUserId);
      socket.join(roomId);
      
      // Admin Ghost Mode: Don't broadcast if admin explicitly joins a room
      if (userRole !== 'ADMIN') {
        socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED_CHAT, { userId, roomId });
      } else {
        logger.info(`Admin ${userId} joined room ${roomId} in ghost mode`);
      }
    });

    // Mark as Read Event (receiver opens conversation)
    socket.on(SOCKET_EVENTS.MESSAGE_READ, async (data: { senderId: string }) => {
      if (!data.senderId) return;
      try {
        // Collect IDs of messages that will be marked as read
        const unreadMessages = await prisma.message.findMany({
          where: {
            senderId: data.senderId,
            receiverId: userId,
            status: { in: ['SENT', 'DELIVERED'] }
          },
          select: { id: true }
        });

        if (unreadMessages.length === 0) return;

        const messageIds = unreadMessages.map(m => m.id);

        await prisma.message.updateMany({
          where: { id: { in: messageIds } },
          data: { status: 'READ' }
        });
        
        // Notify the original sender that their messages were read
        // Emit to the sender's personal room
        io.to(data.senderId).emit(SOCKET_EVENTS.MESSAGE_READ, {
          messageIds,
          partnerId: userId // The person who read the messages
        });
        
        // Also broadcast to other rooms the sender/receiver might be in (e.g. ChatWindow room)
        // We use .except(data.senderId) to ensure they don't get the same event twice
        const roomId = getRoomId(userId, data.senderId);
        socket.to(roomId).except(data.senderId).emit(SOCKET_EVENTS.MESSAGE_READ, {
          messageIds,
          partnerId: userId
        });

      } catch (error) {
        logger.error(`Error marking messages as read:`, error);
      }
    });
    // Send Message Event
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data: { receiverId: string; content?: string; fileUrl?: string; fileName?: string | null; replyToId?: string }) => {
      try {
        const { receiverId, content, fileUrl, fileName, replyToId } = data;
        if (!receiverId) return;
        if (!content && !fileUrl) return; // Ignore empty messages
        
        // 1. Check if block exists (Bidirectional enforcement)
        const block = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: receiverId },
              { blockerId: receiverId, blockedId: userId }
            ]
          }
        });

        if (block) {
          // Rule: Silently drop. Do not save, do not emit to anyone, no error back.
          logger.info(`Message from ${userId} to ${receiverId} silently dropped due to block.`);
          return; 
        }

        // Check if receiver is online
        const receiverSockets = io.sockets.adapter.rooms.get(receiverId);
        const isReceiverOnline = !!receiverSockets && receiverSockets.size > 0;
        const initialStatus = isReceiverOnline ? 'DELIVERED' : 'SENT';

        // Save to Database
        const savedMessage = await prisma.message.create({
          data: {
            content,
            fileUrl,
            fileName: fileName && String(fileName).trim() ? String(fileName).trim().slice(0, 255) : null,
            senderId: userId,
            receiverId,
            replyToId,
            status: initialStatus
          },
          include: {
            sender: { select: { id: true, username: true, displayName: true, profilePic: true, isVerified: true } },
            replyTo: { select: { id: true, content: true, senderId: true, sender: { select: { username: true, displayName: true } } } }
          }
        });

        const roomId = getRoomId(userId, receiverId);
        
        // Broadcast to everyone EXCEPT the sender in the room
        socket.broadcast.to(roomId).emit(SOCKET_EVENTS.NEW_MESSAGE, savedMessage);
        
        // Also emit to the receiver's personal sockets
        if (receiverSockets) {
          Array.from(receiverSockets).forEach((socketId) => {
            const clientSockets = io.sockets.adapter.rooms.get(socketId);
            if (!clientSockets?.has(roomId)) {
              io.to(socketId).emit(SOCKET_EVENTS.NEW_MESSAGE, savedMessage);
            }
          });
        }
        
        // Send confirmation back to the sender
        socket.emit(SOCKET_EVENTS.MESSAGE_CONFIRMED, savedMessage);

        if (isReceiverOnline) {
          socket.emit(SOCKET_EVENTS.MESSAGE_DELIVERED, {
             messageId: savedMessage.id,
             receiverId: savedMessage.receiverId
          });
        }
      } catch (error) {
        logger.error(`Error sending message: ${error}`);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to send message' });
      }
    });

    // Delete Message Event Handling could also be here, but we will use the API route and emit from there, 
    // or we can just let clients listen to MESSAGE_DELETED from the API route's trigger.

    // Typing Indicators
    socket.on(SOCKET_EVENTS.START_TYPING, (data: { targetUserId: string }) => {
      if (!data.targetUserId) return;
      const roomId = getRoomId(userId, data.targetUserId);
      socket.to(roomId).emit(SOCKET_EVENTS.USER_TYPING, { userId, isTyping: true });
    });

    socket.on(SOCKET_EVENTS.STOP_TYPING, (data: { targetUserId: string }) => {
      if (!data.targetUserId) return;
      const roomId = getRoomId(userId, data.targetUserId);
      socket.to(roomId).emit(SOCKET_EVENTS.USER_TYPING, { userId, isTyping: false });
    });

    // Disconnect Event
    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${userId})`);
      
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeen: new Date() },
        });
        socket.broadcast.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, isOnline: false, lastSeen: new Date() });
      } catch (error) {
        logger.error('Failed to update presence on disconnect', error);
      }
    });
  });
};
