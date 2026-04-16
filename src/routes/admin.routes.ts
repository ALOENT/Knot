import express from 'express';
import { getUsers, updateUserStatus } from '../controllers/admin.controller';
import { protect } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/users', getUsers);
router.put('/update-status', updateUserStatus);

export default router;
