"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessage = exports.markAsRead = exports.getConversations = exports.getMessages = void 0;
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const uuidSchema = zod_1.z.string().uuid('Invalid ID format');
const paginationSchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().optional().default(50).transform(n => Math.min(Math.max(isNaN(n) ? 50 : n, 1), 100)),
    cursor: zod_1.z.string().optional().refine(s => !s || !Number.isNaN(new Date(s).getTime()), { message: "Invalid date format" }),
});
/**
 * @desc    Get paginated message history between authenticated user and a partner
 * @route   GET /api/messages/:partnerId
 * @access  Private
 */
const getMessages = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const partnerId = req.params.partnerId;
        const partnerIdValidation = uuidSchema.safeParse(partnerId);
        if (!partnerIdValidation.success) {
            return res.status(400).json({ success: false, message: 'Invalid partner ID format' });
        }
        const paginationResult = paginationSchema.safeParse(req.query);
        if (!paginationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pagination parameters',
                errors: paginationResult.error.issues
            });
        }
        const { limit: take, cursor } = paginationResult.data;
        const whereClause = {
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
        const messages = await db_1.prisma.message.findMany({
            where: whereClause,
            orderBy: { timestamp: 'asc' },
            take,
            select: {
                id: true,
                content: true,
                fileUrl: true,
                fileName: true,
                attachmentBytes: true,
                attachmentPages: true,
                resourceType: true,
                originalName: true,
                fileSize: true,
                senderId: true,
                receiverId: true,
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
        await db_1.prisma.message.updateMany({
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
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch messages', error);
        next(error);
    }
};
exports.getMessages = getMessages;
const getConversations = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        // Lean query: find users who have sent/received messages with currentUser limit using relations
        const partners = await db_1.prisma.user.findMany({
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
        const conversations = await Promise.all(partners.map(async (partner) => {
            const [lastMessage, unreadCount] = await Promise.all([
                db_1.prisma.message.findFirst({
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
                db_1.prisma.message.count({
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
        }));
        // Sort by last message time (newest first)
        const filtered = conversations
            .sort((a, b) => {
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
            return timeB - timeA;
        });
        res.status(200).json({ success: true, conversations: filtered });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch conversations', error);
        next(error);
    }
};
exports.getConversations = getConversations;
/**
 * @desc    Mark all messages from a partner as read
 * @route   PUT /api/messages/mark-read/:partnerId
 * @access  Private
 */
const markAsRead = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { partnerId } = req.params;
        if (!uuidSchema.safeParse(partnerId).success) {
            return res.status(400).json({ success: false, message: 'Invalid partner ID format' });
        }
        await db_1.prisma.message.updateMany({
            where: {
                senderId: partnerId,
                receiverId: userId,
                status: { in: ['SENT', 'DELIVERED'] },
            },
            data: { status: 'READ' },
        });
        res.status(200).json({ success: true });
    }
    catch (error) {
        logger_1.logger.error('Failed to mark as read', error);
        next(error);
    }
};
exports.markAsRead = markAsRead;
/**
 * @desc    Soft delete a message sent by the user
 * @route   DELETE /api/messages/:messageId
 * @access  Private
 */
const deleteMessage = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const { messageId } = req.params;
        if (!uuidSchema.safeParse(messageId).success) {
            return res.status(400).json({ success: false, message: 'Invalid message ID format' });
        }
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const message = await db_1.prisma.message.findUnique({ where: { id: messageId } });
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }
        if (message.senderId !== userId) {
            return res.status(403).json({ success: false, message: 'Only the sender can delete this message' });
        }
        await db_1.prisma.message.update({
            where: { id: messageId },
            data: { isDeleted: true },
        });
        res.status(200).json({ success: true, message: 'Message deleted successfully' });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete message', error);
        next(error);
    }
};
exports.deleteMessage = deleteMessage;
