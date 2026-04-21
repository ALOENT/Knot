import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { uploadFile } from '../controllers/upload.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Memory storage for buffer-based upload to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Sensitive rate limiter: 10 uploads per 15 minutes
const sensitiveRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many upload requests. Please try again later.' },
});

router.post('/', protect, sensitiveRateLimiter, upload.single('file'), uploadFile);

export default router;
