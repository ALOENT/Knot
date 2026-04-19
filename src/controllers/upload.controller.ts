import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../utils/db';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
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

    const attachmentBytes = buffer.length;
    let attachmentPages: number | null = null;
    if (detectedType.mime === 'application/pdf') {
      try {
        const pdfParseMod = await import('pdf-parse');
        const pdfParse = (pdfParseMod as unknown as { default: (data: Buffer) => Promise<{ numpages?: number }> })
          .default;
        const meta = await pdfParse(buffer);
        const n = meta?.numpages;
        attachmentPages = typeof n === 'number' && n > 0 ? n : null;
      } catch (e) {
        logger.error('PDF page count failed', e);
        attachmentPages = null;
      }
    }

    return res.status(200).json({
      success: true,
      fileUrl: (uploadResult as any).secure_url,
      fileName: originalname,
      attachmentBytes,
      ...(attachmentPages != null ? { attachmentPages } : {}),
    });
  } catch (error) {
    logger.error('Failed to upload file to Cloudinary', error);
    return res.status(500).json({ success: false, message: 'File upload failed' });
  }
};

const uuidSchema = z.string().uuid('Invalid message id');

function safeDownloadFilename(name: string): string {
  const t = name.trim() || 'download';
  // Strip ASCII control chars + DEL (header / CRLF injection) and unsafe punctuation, then cap length.
  return t
    .replace(/[\x00-\x1F\x7F]/g, '_')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .slice(0, 200);
}

function deriveFilenameFromStoredUrl(fileUrl: string): string {
  try {
    const seg = new URL(fileUrl).pathname.split('/').filter(Boolean).pop() || 'file';
    return seg.replace(/^\d+_/, '') || 'file';
  } catch {
    return 'file';
  }
}

/** Slightly above multer upload cap (10MB) to allow small overhead. */
const MAX_ATTACHMENT_BYTES = 11 * 1024 * 1024;

function attachmentUpstreamTimeoutMs(): number {
  const n = Number(process.env.ATTACHMENT_UPSTREAM_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 10_000;
}

/**
 * Stream an attachment for a message the user is allowed to see.
 * Cloudinary stays storage-only; clients use this URL with the session cookie.
 * ?mode=inline for <img> / lightbox, ?mode=attachment (default) for downloads.
 */
export const streamMessageAttachment = async (req: Request, res: Response, next: NextFunction) => {
  const messageId = req.params.messageId as string;

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

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

    const timeoutMs = attachmentUpstreamTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(message.fileUrl, { signal: controller.signal });
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name === 'AbortError') {
        logger.error(
          `Attachment upstream fetch aborted messageId=${messageId} name=${e.name} message=${e.message ?? ''}`,
        );
        if (!res.headersSent) {
          return res.status(502).json({ success: false, message: 'Could not retrieve file' });
        }
        return;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!upstream.ok) {
      logger.error(`Attachment upstream ${upstream.status} for message ${messageId}`);
      if (!res.headersSent) {
        return res.status(502).json({ success: false, message: 'Could not retrieve file' });
      }
      return;
    }

    const contentLengthHeader = upstream.headers.get('content-length');
    if (contentLengthHeader) {
      const bytes = parseInt(contentLengthHeader, 10);
      if (Number.isFinite(bytes) && bytes > MAX_ATTACHMENT_BYTES) {
        logger.error(`Attachment too large messageId=${messageId} content-length=${bytes}`);
        if (!res.headersSent) {
          return res.status(413).json({ success: false, message: 'File too large' });
        }
        return;
      }
    }

    const webBody = upstream.body;
    if (!webBody) {
      logger.error(`Attachment upstream empty body messageId=${messageId}`);
      if (!res.headersSent) {
        return res.status(502).json({ success: false, message: 'Could not retrieve file' });
      }
      return;
    }

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

    if (contentLengthHeader && /^\d+$/.test(contentLengthHeader.trim())) {
      res.setHeader('Content-Length', contentLengthHeader.trim());
    }

    const nodeReadable = Readable.fromWeb(webBody as import('stream/web').ReadableStream);

    try {
      await pipeline(nodeReadable, res);
    } catch (pipeErr) {
      logger.error(`Attachment stream pipeline failed messageId=${messageId}`, pipeErr);
      if (!res.headersSent) {
        return res.status(502).json({ success: false, message: 'Could not retrieve file' });
      }
      res.destroy(pipeErr as Error);
    }
  } catch (error) {
    logger.error('streamMessageAttachment failed', error);
    if (!res.headersSent) {
      next(error);
    } else {
      res.destroy(error as Error);
    }
  }
};
