import express from 'express';
import { getUsers, updateUserStatus, getReports, resolveReport, warnUser } from '../controllers/admin.controller';
import { protect } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/users', getUsers);
router.put('/update-status', updateUserStatus);

// Reports management
router.get('/reports', getReports);
router.put('/reports/:id/resolve', resolveReport);
router.post('/warn/:userId', warnUser);

export default router;
