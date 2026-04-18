import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { Readable } from 'stream';

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

    const { buffer, originalname, mimetype: multerMime } = req.file;

    // Security - Content-based MIME-type check (Security Audit item)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    
    // Dynamic import for file-type (ESM)
    const { fromBuffer } = await (eval('import("file-type")') as Promise<typeof import('file-type')>);
    const detectedType = await fromBuffer(buffer);
    
    const finalMime = detectedType ? detectedType.mime : multerMime;

    if (!allowedMimeTypes.includes(finalMime)) {
      return res.status(400).json({ success: false, message: 'Invalid file content type' });
    }

    // Use upload_stream for memory storage adapter with robust piping
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'knot_chat_uploads',
          resource_type: 'auto',
          public_id: `${Date.now()}_${originalname.replace(/[^a-zA-Z0-9_.-]/g, '')}`,
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload_stream callback error', error);
            return reject(error);
          }
          resolve(result);
        }
      );

      // Create a readable stream from buffer and pipe it to Cloudinary
      const readableStream = new Readable();
      readableStream._read = () => {}; 
      readableStream.push(buffer);
      readableStream.push(null);
      
      readableStream.on('error', (err) => {
        logger.error('Readable stream error during upload', err);
        reject(err);
      });

      readableStream.pipe(uploadStream);
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
