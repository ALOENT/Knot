"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dismissWarning = exports.getWarnings = exports.getBlockedUsers = exports.unblockUser = exports.blockUser = exports.getUserProfile = exports.updateProfile = exports.getAllUsers = exports.searchUsers = void 0;
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const idSchema = zod_1.z.string().uuid('Invalid ID format');
const updateProfileSchema = zod_1.z.object({
    username: zod_1.z.string().min(3, 'Username must be at least 3 characters').optional(),
    displayName: zod_1.z.string().max(50, 'Display name too long').nullable().optional(),
    bio: zod_1.z.string().max(160, 'Bio too long').nullable().optional(),
    profilePic: zod_1.z.string().url('Invalid URL').nullable().optional(),
});
const isAdminUser = (user) => {
    return user?.role === 'ADMIN';
};
/**
 * @desc    Search users by username or email
 * @route   GET /api/users/search?query=...
 * @access  Private
 */
const searchUsers = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const { query } = req.query;
        if (!query || typeof query !== 'string' || query.length < 2) {
            return res.status(400).json({ success: false, message: 'Please provide at least 2 characters to search' });
        }
        const includeEmail = isAdminUser(req.user);
        const users = await db_1.prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: 'insensitive' } },
                    ...(includeEmail ? [{ email: { contains: query, mode: 'insensitive' } }] : [])
                ],
                id: { not: req.user.id }
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                email: includeEmail,
                profilePic: true,
                isOnline: true,
                lastSeen: true,
                bio: true,
                isVerified: true,
            },
            take: 20
        });
        res.status(200).json({ success: true, users });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error while searching users' });
    }
};
exports.searchUsers = searchUsers;
/**
 * @desc    Get all system users (Fallback approach to behave as Contacts)
 * @route   GET /api/users
 * @access  Private
 */
const getAllUsers = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const includeEmail = isAdminUser(req.user);
        const take = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const skip = Math.max(parseInt(req.query.offset) || 0, 0);
        const cursor = req.query.cursor;
        const whereClause = {
            id: { not: req.user.id }
        };
        if (cursor && idSchema.safeParse(cursor).success) {
            whereClause.id = {
                ...whereClause.id,
                gt: cursor
            };
        }
        const users = await db_1.prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                username: true,
                displayName: true,
                email: includeEmail,
                profilePic: true,
                isOnline: true,
                lastSeen: true,
                isVerified: true,
            },
            orderBy: {
                id: 'asc'
            },
            take,
            skip: (cursor && idSchema.safeParse(cursor).success) ? undefined : skip
        });
        const hasMore = users.length === take;
        const nextCursor = hasMore && users.length > 0 ? users[users.length - 1].id : undefined;
        const countWhere = { id: { not: req.user.id } };
        const total = await db_1.prisma.user.count({ where: countWhere });
        res.status(200).json({
            success: true,
            users,
            pagination: {
                total,
                limit: take,
                offset: skip,
                cursor: cursor || null,
                hasMore,
                nextCursor
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error while fetching contacts' });
    }
};
exports.getAllUsers = getAllUsers;
/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const validation = updateProfileSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ success: false, message: validation.error.issues[0].message });
        }
        const { username, displayName, bio, profilePic } = validation.data;
        // Check if username is already taken by someone else
        if (username) {
            const existingUser = await db_1.prisma.user.findFirst({
                where: {
                    username,
                    id: { not: req.user.id }
                }
            });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Username is already taken' });
            }
        }
        const updatedUser = await db_1.prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(username && { username }),
                ...(displayName !== undefined && { displayName: displayName === '' ? null : displayName }),
                ...(bio !== undefined && { bio: bio === '' ? null : bio }),
                ...(profilePic !== undefined && { profilePic: profilePic === '' ? null : profilePic }),
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                email: true,
                profilePic: true,
                bio: true,
                isOnline: true,
                role: true,
                isVerified: true,
                privacySettings: true
            }
        });
        res.status(200).json({ success: true, user: updatedUser });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error while updating profile' });
    }
};
exports.updateProfile = updateProfile;
/**
 * @desc    Get user profile (public fields only)
 * @route   GET /api/users/:userId
 * @access  Private
 */
const getUserProfile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const userId = req.params.userId;
        // Check for block (Bidirectional)
        const block = await db_1.prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: req.user.id, blockedId: userId },
                    { blockerId: userId, blockedId: req.user.id }
                ]
            }
        });
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                displayName: true,
                bio: true,
                profilePic: true,
                banner: true,
                isOnline: true,
                lastSeen: true,
                isVerified: true,
                createdAt: true,
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Redact info if blocked
        if (block) {
            user.profilePic = null;
            user.bio = null;
            user.banner = null;
            user.isOnline = false;
            user.lastSeen = null; // Fix: use null for never seen (Issue 6)
        }
        return res.status(200).json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error while fetching profile' });
    }
};
exports.getUserProfile = getUserProfile;
/**
 * @desc    Block a user
 * @route   POST /api/users/block/:userId
 * @access  Private
 */
const blockUser = async (req, res) => {
    try {
        const blockerId = req.user?.id;
        const blockedId = req.params.userId;
        if (!blockerId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        if (blockerId === blockedId)
            return res.status(400).json({ success: false, message: 'Cannot block yourself' });
        await db_1.prisma.block.upsert({
            where: {
                blockerId_blockedId: { blockerId, blockedId }
            },
            update: {},
            create: { blockerId, blockedId }
        });
        res.status(200).json({ success: true, message: 'User blocked successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to block user' });
    }
};
exports.blockUser = blockUser;
/**
 * @desc    Unblock a user
 * @route   DELETE /api/users/block/:userId
 * @access  Private
 */
const unblockUser = async (req, res) => {
    try {
        const blockerId = req.user?.id;
        const blockedId = req.params.userId;
        if (!blockerId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        await db_1.prisma.block.deleteMany({
            where: { blockerId, blockedId }
        });
        res.status(200).json({ success: true, message: 'User unblocked successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to unblock user' });
    }
};
exports.unblockUser = unblockUser;
/**
 * @desc    Get blocked users
 * @route   GET /api/users/blocked
 * @access  Private
 */
/**
 * @desc    Get bidirectional blocks for the current user
 * @route   GET /api/users/blocked
 * @access  Private
 */
const getBlockedUsers = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        // Users I have blocked
        const blocked = await db_1.prisma.block.findMany({
            where: { blockerId: userId },
            include: {
                blocked: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        profilePic: true,
                    }
                }
            }
        });
        // Users who have blocked me
        const blockedBy = await db_1.prisma.block.findMany({
            where: { blockedId: userId },
            select: { blockerId: true }
        });
        res.status(200).json({
            success: true,
            blockedUsers: blocked.map(b => b.blocked),
            blockedByIDs: blockedBy.map(b => b.blockerId)
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch blocked users' });
    }
};
exports.getBlockedUsers = getBlockedUsers;
/**
 * @desc    Get undismissed warnings for the current user
 * @route   GET /api/users/warnings
 * @access  Private
 */
const getWarnings = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        const warnings = await db_1.prisma.warning.findMany({
            where: { userId, isDismissed: false },
            orderBy: { createdAt: 'asc' }
        });
        res.status(200).json({ success: true, warnings });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch warnings' });
    }
};
exports.getWarnings = getWarnings;
/**
 * @desc    Dismiss a warning
 * @route   PUT /api/users/warnings/:id/dismiss
 * @access  Private
 */
const dismissWarning = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        const warningId = req.params.id;
        // Validate ID (Issue 7)
        try {
            idSchema.parse(warningId);
        }
        catch (e) {
            return res.status(400).json({ success: false, message: e.message || 'Invalid warning ID' });
        }
        // Ownership-safe update using updateMany
        const updateResult = await db_1.prisma.warning.updateMany({
            where: {
                id: warningId,
                userId,
                isDismissed: false
            },
            data: { isDismissed: true }
        });
        if (updateResult.count === 0) {
            return res.status(404).json({ success: false, message: 'Warning not found or already dismissed' });
        }
        res.status(200).json({ success: true, message: 'Warning dismissed' });
    }
    catch (error) {
        logger_1.logger.error('Error dismissing warning:', error);
        res.status(500).json({ success: false, message: 'Failed to dismiss warning' });
    }
};
exports.dismissWarning = dismissWarning;
