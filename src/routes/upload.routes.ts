import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { uploadFile, streamMessageAttachment } from '../controllers/upload.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

// Storage strategy: memory
const storage = multer.memoryStorage();

// Multer setup: 10MB limit, specific file types
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Rate limiter: 10 requests per 15 minutes
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many upload requests. Please try again later.' }
});

const attachmentDownloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { success: false, message: 'Too many download requests. Please try again later.' }
});

router.get(
  '/message/:messageId/file',
  protect,
  attachmentDownloadLimiter,
  streamMessageAttachment,
);

router.post('/', protect, uploadLimiter, upload.single('file'), uploadFile);

export default router;
