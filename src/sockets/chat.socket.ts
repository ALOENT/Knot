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

    // Mark as Read Event
    socket.on(SOCKET_EVENTS.MESSAGE_READ, async (data: { senderId: string }) => {
      if (!data.senderId) return;
      try {
        await prisma.message.updateMany({
          where: {
            senderId: data.senderId,
            receiverId: userId,
            status: { in: ['SENT', 'DELIVERED'] }
          },
          data: { status: 'READ' }
        });
        
        // Notify the original sender that their messages were read
        const senderSockets = io.sockets.adapter.rooms.get(data.senderId);
        if (senderSockets) {
          io.to(data.senderId).emit(SOCKET_EVENTS.MESSAGE_READ, {
            readerId: userId
          });
        }
      } catch (error) {
        logger.error(`Error marking messages as read:`, error);
      }
    });
      
      // Admin Ghost Mode: Don't broadcast if admin explicitly joins a room
      if (userRole !== 'ADMIN') {
        socket.to(roomId).emit('user_joined_chat', { userId, roomId });
      } else {
        logger.info(`Admin ${userId} joined room ${roomId} in ghost mode`);
      }
    });

    // Send Message Event
    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data: { receiverId: string; content?: string; fileUrl?: string; replyToId?: string }) => {
      try {
        const { receiverId, content, fileUrl, replyToId } = data;
        if (!receiverId) return;
        if (!content && !fileUrl) return; // Ignore empty messages
        
        // Check if block exists
        const block = await prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: userId, blockedId: receiverId },
              { blockerId: receiverId, blockedId: userId }
            ]
          }
        });

        if (block) {
          // If you blocked them, UI should prevent this, but just in case:
          if (block.blockerId === userId) {
             socket.emit(SOCKET_EVENTS.ERROR, { message: 'You have blocked this user' });
             return;
          }
          // If they blocked you, silently fail:
          const fakeMessage = {
             id: `fake_${Date.now()}`,
             content,
             fileUrl,
             senderId: userId,
             receiverId,
             replyToId,
             status: 'SENT',
             isDeleted: false,
             timestamp: new Date().toISOString(),
             sender: { id: userId, username: 'you', displayName: 'you', profilePic: null }
          };
          socket.emit(SOCKET_EVENTS.MESSAGE_CONFIRMED, fakeMessage);
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
