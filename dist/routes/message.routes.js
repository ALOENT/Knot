"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_controller_1 = require("../controllers/message.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// All message routes require authentication
router.use(auth_middleware_1.protect);
// IMPORTANT: /conversations must be registered BEFORE /:partnerId
// otherwise Express treats "conversations" as a partnerId param
router.get('/conversations', message_controller_1.getConversations);
router.put('/mark-read/:partnerId', message_controller_1.markAsRead);
router.delete('/:messageId', message_controller_1.deleteMessage);
router.get('/:partnerId', message_controller_1.getMessages);
exports.default = router;
