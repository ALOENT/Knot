"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = exports.searchUsers = void 0;
const db_1 = require("../utils/db");
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
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ success: false, message: 'Please provide a valid search query' });
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
                email: includeEmail,
                profilePic: true,
                isOnline: true,
                lastSeen: true,
                bio: true,
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
        if (cursor) {
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
                email: includeEmail,
                profilePic: true,
                isOnline: true,
                lastSeen: true,
            },
            orderBy: {
                id: 'asc'
            },
            take,
            skip: cursor ? undefined : skip
        });
        const hasMore = users.length === take;
        const nextCursor = hasMore && users.length > 0 ? users[users.length - 1].id : undefined;
        res.status(200).json({
            success: true,
            users,
            pagination: {
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
