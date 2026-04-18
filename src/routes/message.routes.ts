import { Router } from 'express';
import { getMessages, getConversations, markAsRead, deleteMessage } from '../controllers/message.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// All message routes require authentication
router.use(protect);

// IMPORTANT: /conversations must be registered BEFORE /:partnerId
// otherwise Express treats "conversations" as a partnerId param
router.get('/conversations', getConversations);
router.put('/mark-read/:partnerId', markAsRead);
router.delete('/:messageId', deleteMessage);
router.get('/:partnerId', getMessages);

export default router;
