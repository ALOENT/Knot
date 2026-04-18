"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReport = void 0;
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const reportSchema = zod_1.z.object({
    reportedUserId: zod_1.z.string().uuid('Invalid user ID format'),
    reason: zod_1.z.string().trim().min(1, 'Reason is required').max(500, 'Reason cannot exceed 500 characters'),
});
/**
 * @desc    Create a new report for a user
 * @route   POST /api/reports
 * @access  Private
 */
const createReport = async (req, res, next) => {
    try {
        const reporterId = req.user?.id;
        if (!reporterId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const validation = reportSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: validation.error.issues[0].message
            });
        }
        const { reportedUserId, reason: trimmedReason } = validation.data;
        // Prevent reporting self
        if (reporterId === reportedUserId) {
            return res.status(400).json({ success: false, message: 'You cannot report yourself' });
        }
        // Check if reported user exists
        const reportedUser = await db_1.prisma.user.findUnique({ where: { id: reportedUserId } });
        if (!reportedUser) {
            return res.status(404).json({ success: false, message: 'Reported user not found' });
        }
        // Fetch last 15 messages for context
        const contextMessages = await db_1.prisma.message.findMany({
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
        // FIX 4: Reverse the order to chronological (oldest first)
        contextMessages.reverse();
        // Create the report
        const report = await db_1.prisma.report.create({
            data: {
                reporterId,
                reportedUserId,
                reason: trimmedReason,
                contextMessages: contextMessages, // Snapshot
            },
        });
        res.status(201).json({ success: true, data: report });
    }
    catch (error) {
        logger_1.logger.error('Failed to create report', error);
        next(error);
    }
};
exports.createReport = createReport;
