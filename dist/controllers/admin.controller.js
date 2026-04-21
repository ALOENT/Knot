"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warnUser = exports.resolveReport = exports.getReports = exports.updateUserStatus = exports.getUsers = void 0;
const db_1 = require("../utils/db");
const zod_1 = require("zod");
const getUsers = async (req, res, next) => {
    try {
        const isAdminUser = req.user?.role === 'ADMIN';
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
        const search = req.query.search || '';
        const skip = (page - 1) * limit;
        const where = {};
        if (search) {
            where.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }
        const [users, totalUsers] = await Promise.all([
            db_1.prisma.user.findMany({
                where,
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
            db_1.prisma.user.count({ where })
        ]);
        const totalAgents = await db_1.prisma.user.count({ where: { role: 'ADMIN' } });
        const conversations = await db_1.prisma.message.groupBy({ by: ['senderId', 'receiverId'] });
        const activeConversations = conversations.length;
        const bannedEntities = await db_1.prisma.user.count({ where: { isBanned: true } });
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
    }
    catch (error) {
        next(error);
    }
};
exports.getUsers = getUsers;
const updateStatusSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().uuid('Invalid user ID'),
        isBanned: zod_1.z.boolean().optional(),
        isVerified: zod_1.z.boolean().optional(),
    }),
});
const updateUserStatus = async (req, res, next) => {
    try {
        updateStatusSchema.parse(req);
        const { userId, isBanned, isVerified } = req.body;
        const data = {};
        if (typeof isBanned !== 'undefined')
            data.isBanned = isBanned;
        if (typeof isVerified !== 'undefined')
            data.isVerified = isVerified;
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ success: false, message: 'Nothing to update' });
        }
        const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (data.isBanned && user.role === 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Cannot ban an admin' });
        }
        const updatedUser = await db_1.prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                role: true,
                isBanned: true,
                isVerified: true,
            }
        });
        res.status(200).json({ success: true, data: updatedUser, message: 'Status updated successfully' });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserStatus = updateUserStatus;
/**
 * @desc    Get all reports
 * @route   GET /api/admin/reports
 * @access  Private/Admin
 */
const getReports = async (req, res, next) => {
    try {
        const reports = await db_1.prisma.report.findMany({
            include: {
                reporter: {
                    select: { id: true, username: true, displayName: true, profilePic: true }
                },
                reportedUser: {
                    select: { id: true, username: true, displayName: true, profilePic: true }
                }
            },
            orderBy: [
                { status: 'asc' }, // PENDING first
                { createdAt: 'desc' }
            ]
        });
        res.status(200).json({ success: true, data: reports });
    }
    catch (error) {
        next(error);
    }
};
exports.getReports = getReports;
/**
 * @desc    Resolve a report
 * @route   PUT /api/admin/reports/:id/resolve
 * @access  Private/Admin
 */
const resolveReport = async (req, res, next) => {
    try {
        const id = req.params.id;
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({ success: false, message: 'Invalid report ID format' });
        }
        // Check if report exists
        const existingReport = await db_1.prisma.report.findUnique({ where: { id } });
        if (!existingReport) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }
        const report = await db_1.prisma.report.update({
            where: { id },
            data: { status: 'RESOLVED' }
        });
        res.status(200).json({ success: true, data: report, message: 'Report resolved' });
    }
    catch (error) {
        next(error);
    }
};
exports.resolveReport = resolveReport;
/**
 * @desc    Issue a warning to a user
 * @route   POST /api/admin/warn/:userId
 * @access  Private/Admin
 */
const warnUser = async (req, res, next) => {
    try {
        const userId = req.params.userId;
        const { message } = req.body;
        // Validate UUID format (Issue 5 - reuse regex from resolveReport)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID format' });
        }
        if (!message) {
            return res.status(400).json({ success: false, message: 'Warning message is required' });
        }
        // Verify target user exists (Issue 4)
        const targetUser = await db_1.prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const warning = await db_1.prisma.warning.create({
            data: {
                userId,
                message
            }
        });
        res.status(201).json({ success: true, data: warning, message: 'User warned successfully' });
    }
    catch (error) {
        next(error);
    }
};
exports.warnUser = warnUser;
