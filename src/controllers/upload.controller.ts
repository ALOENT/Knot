import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_SECRET,
});

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype } = req.file;

    // Use upload_stream for memory storage adapter
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'knot_chat_uploads',
          resource_type: 'auto', // Auto detects image, pdf, raw, etc.
          public_id: `${Date.now()}_${originalname.replace(/[^a-zA-Z0-9_.-]/g, '')}`,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      
      uploadStream.end(buffer);
    });

    return res.status(200).json({
      success: true,
      fileUrl: (uploadResult as any).secure_url,
    });
  } catch (error) {
    logger.error('Failed to upload file to Cloudinary', error);
    return res.status(500).json({ success: false, message: 'File upload failed' });
  }
};
