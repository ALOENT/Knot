"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Protect all user routes
router.use(auth_middleware_1.protect);
router.get('/search', user_controller_1.searchUsers);
router.get('/', user_controller_1.getAllUsers);
exports.default = router;
