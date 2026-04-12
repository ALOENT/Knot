"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initChatSocket = void 0;
const cookie_1 = __importDefault(require("cookie"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const getRoomId = (userId1, userId2) => {
    return [userId1, userId2].sort().join('-');
};
const initChatSocket = (io) => {
    // Authentication Middleware
    io.use(async (socket, next) => {
        try {
            const parsedCookies = cookie_1.default.parse(socket.request.headers.cookie || '');
            const token = parsedCookies.jwt;
            if (!token) {
                return next(new Error('Authentication error: Missing cookie'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            const user = await db_1.prisma.user.findUnique({ where: { id: decoded.id } });
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }
            socket.user = {
                id: user.id,
                role: user.role,
            };
            next();
        }
        catch (error) {
            next(new Error('Authentication error: Invalid token'));
        }
    });
    io.on('connection', async (socket) => {
        // If we're here, auth middleware succeeded so socket.user exists
        const userId = socket.user.id;
        const userRole = socket.user.role;
        logger_1.logger.info(`Socket connected: ${socket.id} (User: ${userId}, Role: ${userRole})`);
        // Update presence
        try {
            await db_1.prisma.user.update({
                where: { id: userId },
                data: { isOnline: true, lastSeen: new Date() },
            });
            socket.broadcast.emit('presence_update', { userId, isOnline: true, lastSeen: new Date() });
        }
        catch (error) {
            logger_1.logger.error('Failed to update presence on connect', error);
        }
        // Join generic user room for direct notifications
        socket.join(userId);
        // Join Chat Event
        socket.on('join_chat', (data) => {
            if (!data.targetUserId)
                return;
            const roomId = getRoomId(userId, data.targetUserId);
            socket.join(roomId);
            // Admin Ghost Mode: Don't broadcast if admin explicitly joins a room
            if (userRole !== 'ADMIN') {
                socket.to(roomId).emit('user_joined_chat', { userId, roomId });
            }
            else {
                logger_1.logger.info(`Admin ${userId} joined room ${roomId} in ghost mode`);
            }
        });
        // Send Message Event
        socket.on('send_message', async (data) => {
            try {
                const { receiverId, content, fileUrl } = data;
                if (!receiverId)
                    return;
                if (!content && !fileUrl)
                    return; // Ignore empty messages
                // Save to Database
                const savedMessage = await db_1.prisma.message.create({
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
                // Emit in real-time to the room (includes ghost admins)
                io.to(roomId).emit('new_message', savedMessage);
            }
            catch (error) {
                logger_1.logger.error(`Error sending message: ${error}`);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });
        // Typing Indicators
        socket.on('start_typing', (data) => {
            if (!data.targetUserId)
                return;
            const roomId = getRoomId(userId, data.targetUserId);
            socket.to(roomId).emit('user_typing', { userId, isTyping: true });
        });
        socket.on('stop_typing', (data) => {
            if (!data.targetUserId)
                return;
            const roomId = getRoomId(userId, data.targetUserId);
            socket.to(roomId).emit('user_typing', { userId, isTyping: false });
        });
        // Disconnect Event
        socket.on('disconnect', async () => {
            logger_1.logger.info(`Socket disconnected: ${socket.id} (User: ${userId})`);
            try {
                await db_1.prisma.user.update({
                    where: { id: userId },
                    data: { isOnline: false, lastSeen: new Date() },
                });
                socket.broadcast.emit('presence_update', { userId, isOnline: false, lastSeen: new Date() });
            }
            catch (error) {
                logger_1.logger.error('Failed to update presence on disconnect', error);
            }
        });
    });
};
exports.initChatSocket = initChatSocket;
