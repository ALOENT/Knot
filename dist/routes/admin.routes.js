"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const admin_middleware_1 = require("../middlewares/admin.middleware");
const router = express_1.default.Router();
router.use(auth_middleware_1.protect, admin_middleware_1.requireAdmin);
router.get('/users', admin_controller_1.getUsers);
router.put('/update-status', admin_controller_1.updateUserStatus);
// Reports management
router.get('/reports', admin_controller_1.getReports);
router.put('/reports/:id/resolve', admin_controller_1.resolveReport);
exports.default = router;
