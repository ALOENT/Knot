import { Router } from 'express';
import { searchUsers, getAllUsers, updateProfile } from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Protect all user routes
router.use(protect);

router.get('/search', searchUsers);
router.get('/', getAllUsers);
router.put('/profile', updateProfile);

export default router;
