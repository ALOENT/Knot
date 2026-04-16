import { Router } from 'express';
import { createReport } from '../controllers/report.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.post('/', createReport);

export default router;
