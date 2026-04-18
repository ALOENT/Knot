"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const zod_1 = require("zod");
const errorHandler = (err, req, res, next) => {
    // Anonymize IP if not configured to include it
    const maskIp = (ip) => {
        if (!ip)
            return 'unknown';
        if (ip.includes(':')) {
            // IPv6 - mask last part
            return ip.split(':').slice(0, 3).join(':') + ':****';
        }
        // IPv4 - mask last two octets
        return ip.split('.').slice(0, 2).join('.') + '.*.*';
    };
    const displayIp = env_1.env.LOG_INCLUDE_IP ? req.ip : maskIp(req.ip || '');
    // Log the error
    logger_1.logger.error(`${err.message} - ${req.method} ${req.url} - ${displayIp}`);
    if (err.stack && env_1.env.NODE_ENV === 'development') {
        logger_1.logger.error(err.stack);
    }
    // Handle Zod Validation Errors
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: err.issues.map((e) => ({ path: e.path.join('.'), message: e.message }))
        });
    }
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        message,
        ...(env_1.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
