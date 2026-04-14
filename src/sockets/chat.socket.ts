import { Server, Socket } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../utils/db';
import { logger } from '../utils/logger';

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
    socket.on('join_chat', (data: { targetUserId: string }) => {
      if (!data.targetUserId) return;
      const roomId = getRoomId(userId, data.targetUserId);
      socket.join(roomId);
      
      // Admin Ghost Mode: Don't broadcast if admin explicitly joins a room
      if (userRole !== 'ADMIN') {
        socket.to(roomId).emit('user_joined_chat', { userId, roomId });
      } else {
        logger.info(`Admin ${userId} joined room ${roomId} in ghost mode`);
      }
    });

    // Send Message Event
    socket.on('send_message', async (data: { receiverId: string; content?: string; fileUrl?: string }) => {
      try {
        const { receiverId, content, fileUrl } = data;
        if (!receiverId) return;
        if (!content && !fileUrl) return; // Ignore empty messages
        
        // Save to Database
        const savedMessage = await prisma.message.create({
          data: {
            content,
            fileUrl,
            senderId: userId,
            receiverId,
          },
          include: {
            sender: { select: { id: true, username: true, profilePic: true } }
          }
        });

        const roomId = getRoomId(userId, receiverId);
        
        // Broadcast to everyone EXCEPT the sender in the room
        socket.broadcast.to(roomId).emit('new_message', savedMessage);
        
        // Also emit to the receiver's personal sockets if they aren't in the DM room
        // to avoid duplicate delivery while ensuring all their connections get the message
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        const receiverSockets = io.sockets.adapter.rooms.get(receiverId);

        if (receiverSockets) {
          Array.from(receiverSockets).forEach((socketId) => {
            if (!roomSockets?.has(socketId)) {
              io.to(socketId).emit('new_message', savedMessage);
            }
          });
        }
        
        // Send confirmation back to the sender only (replaces optimistic temp message)
        socket.emit('message_confirmed', savedMessage);
      } catch (error) {
        logger.error(`Error sending message: ${error}`);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing Indicators
    socket.on('start_typing', (data: { targetUserId: string }) => {
      if (!data.targetUserId) return;
      const roomId = getRoomId(userId, data.targetUserId);
      socket.to(roomId).emit('user_typing', { userId, isTyping: true });
    });

    socket.on('stop_typing', (data: { targetUserId: string }) => {
      if (!data.targetUserId) return;
      const roomId = getRoomId(userId, data.targetUserId);
      socket.to(roomId).emit('user_typing', { userId, isTyping: false });
    });

    // Disconnect Event
    socket.on('disconnect', async () => {
      logger.info(`Socket disconnected: ${socket.id} (User: ${userId})`);
      
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeen: new Date() },
        });
        socket.broadcast.emit('presence_update', { userId, isOnline: false, lastSeen: new Date() });
      } catch (error) {
        logger.error('Failed to update presence on disconnect', error);
      }
    });
  });
};
