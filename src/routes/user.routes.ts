import { Router } from 'express';
import { searchUsers, getAllUsers, updateProfile, getUserProfile, getBlockedUsers, blockUser, unblockUser } from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Protect all user routes
router.use(protect);

router.get('/search', searchUsers);
router.get('/blocked', getBlockedUsers); // MUST be before /:userId
router.get('/', getAllUsers);
router.put('/profile', updateProfile);
router.post('/block/:userId', blockUser);
router.delete('/block/:userId', unblockUser);
router.get('/:userId', getUserProfile);

export default router;
