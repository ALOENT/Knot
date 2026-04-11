"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = void 0;
const requireAdmin = (req, res, next) => {
    if (req.user &&
        (req.user.role === 'ADMIN' || req.user.email === process.env.ADMIN_EMAIL)) {
        next();
    }
    else {
        res.status(403).json({ success: false, message: 'Not authorized as an admin' });
    }
};
exports.requireAdmin = requireAdmin;
