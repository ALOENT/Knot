import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../utils/db';
import { Readable } from 'stream';
import { z } from 'zod';

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
    
    // Static dynamic import for file-type (ESM)
    const { fileTypeFromBuffer } = await (import('file-type') as any);
    const detectedType = await fileTypeFromBuffer(buffer);
    
    if (!detectedType) {
      return res.status(400).json({ success: false, message: 'Unable to determine file type or invalid content' });
    }

    if (!allowedMimeTypes.includes(detectedType.mime)) {
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
      fileName: originalname,
    });
  } catch (error) {
    logger.error('Failed to upload file to Cloudinary', error);
    return res.status(500).json({ success: false, message: 'File upload failed' });
  }
};

const uuidSchema = z.string().uuid('Invalid message id');

function safeDownloadFilename(name: string): string {
  const t = name.trim() || 'download';
  return t.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 200);
}

function deriveFilenameFromStoredUrl(fileUrl: string): string {
  try {
    const seg = new URL(fileUrl).pathname.split('/').filter(Boolean).pop() || 'file';
    return seg.replace(/^\d+_/, '') || 'file';
  } catch {
    return 'file';
  }
}

/**
 * Stream an attachment for a message the user is allowed to see.
 * Cloudinary stays storage-only; clients use this URL with the session cookie.
 * ?mode=inline for <img> / lightbox, ?mode=attachment (default) for downloads.
 */
export const streamMessageAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const messageId = req.params.messageId as string;
    if (!uuidSchema.safeParse(messageId).success) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const mode = req.query.mode === 'inline' ? 'inline' : 'attachment';

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        fileUrl: { not: null },
        isDeleted: false,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: { fileUrl: true, fileName: true },
    });

    if (!message?.fileUrl) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const upstream = await fetch(message.fileUrl);
    if (!upstream.ok) {
      logger.error(`Attachment upstream ${upstream.status} for message ${messageId}`);
      return res.status(502).json({ success: false, message: 'Could not retrieve file' });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const displayName = safeDownloadFilename(
      message.fileName || deriveFilenameFromStoredUrl(message.fileUrl),
    );

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';

    if (mode === 'inline') {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(displayName)}`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
    } else {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(displayName)}`);
    }

    res.send(buffer);
  } catch (error) {
    logger.error('streamMessageAttachment failed', error);
    next(error);
  }
};
