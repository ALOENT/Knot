"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../utils/db");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        // Ping the database to check if the connection is active
        await db_1.prisma.$queryRaw `SELECT 1`;
        res.status(200).json({
            success: true,
            status: 'UP',
            timestamp: new Date().toISOString(),
            database: 'connected',
        });
    }
    catch (error) {
        logger_1.logger.error('Health check failed: Database connection error', error);
        res.status(503).json({
            success: false,
            status: 'DOWN',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
        });
    }
});
exports.default = router;
