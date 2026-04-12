import { Router } from 'express';
import { searchUsers, getAllUsers } from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Protect all user routes
router.use(protect);

router.get('/search', searchUsers);
router.get('/', getAllUsers);

export default router;
