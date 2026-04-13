import { Router } from 'express';
import { getMessages, getConversations } from '../controllers/message.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// All message routes require authentication
router.use(protect);

// IMPORTANT: /conversations must be registered BEFORE /:partnerId
// otherwise Express treats "conversations" as a partnerId param
router.get('/conversations', getConversations);
router.get('/:partnerId', getMessages);

export default router;
