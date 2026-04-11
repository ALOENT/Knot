import { Router } from 'express';
import { register, login, logout, getMe, registerSchema, loginSchema } from '../controllers/auth.controller';
import { validateRequest } from '../middlewares/validate.middleware';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
