import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../utils/db';
import { Readable, Transform } from 'stream';
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

    // Static dynamic import for file-type (ESM)
    const { fileTypeFromBuffer } = await (import('file-type') as any);
    const detectedType = await fileTypeFromBuffer(buffer);
    
    if (!detectedType) {
      return res.status(400).json({ success: false, message: 'Unable to determine file type or invalid content' });
    }


    // Detect and force correct Cloudinary resource_type
    // PDFs must be 'raw' for reliable file delivery; 'auto' often puts them in the 'image' bucket which fails to load in browsers.
    const isImage = detectedType.mime.startsWith('image/');
    const isVideo = detectedType.mime.startsWith('video/');
    const resourceType = isImage ? 'image' : isVideo ? 'video' : 'raw';

    const allowedMimeTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime',
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'application/zip', 'application/x-zip-compressed'
    ];
    
    if (!allowedMimeTypes.includes(detectedType.mime)) {
      return res.status(400).json({ success: false, message: `File type ${detectedType.mime} not allowed` });
    }

    // Use upload_stream for memory storage adapter with robust piping
    const uploadResult = await new Promise((resolve, reject) => {
      // Clean name: remove extension for public_id to avoid double extensions (.pdf.pdf)
      const cleanName = originalname.substring(0, originalname.lastIndexOf('.')) || originalname;
      const sanitizedName = cleanName.replace(/[^a-zA-Z0-9_.-]/g, '');

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'knot_chat_uploads',
          resource_type: resourceType,
          public_id: `${Date.now()}_${sanitizedName}`,
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

    let fileUrl = (uploadResult as any).secure_url;
    // Fix: Injection of fl_attachment for raw files to trigger download and bypass 401 issues
    if ((uploadResult as any).resource_type === 'raw') {
      fileUrl = fileUrl.replace('/raw/upload/', '/raw/upload/fl_attachment/');
    }

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
      fileUrl,
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

/** Size-limiting transform stream that counts bytes and aborts when limit exceeded. */
class SizeLimitStream extends Transform {
  private bytesSeen = 0;
  private limit: number;
  private messageId: string;
  private limitExceeded = false;

  constructor(limit: number, messageId: string) {
    super();
    this.limit = limit;
    this.messageId = messageId;
  }

  _transform(chunk: Buffer, _encoding: string, callback: (err?: Error | null) => void): void {
    if (this.limitExceeded) {
      callback(new Error(`Size limit exceeded`));
      return;
    }

    const chunkLen = chunk.length;
    this.bytesSeen += chunkLen;

    if (this.bytesSeen > this.limit) {
      this.limitExceeded = true;
      logger.error(
        `Attachment size limit exceeded messageId=${this.messageId} bytes=${this.bytesSeen} limit=${this.limit}`,
      );
      callback(new Error(`Size limit exceeded`));
      return;
    }

    this.push(chunk);
    callback();
  }
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
    let fetchError: string = '';
    try {
      logger.info(`Fetching attachment from Cloudinary: ${message.fileUrl}`);
      upstream = await fetch(message.fileUrl, { signal: controller.signal });
      logger.info(`Cloudinary response status: ${upstream.status} for messageId=${messageId}`);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string; cause?: string };
      fetchError = e.message || e.name || 'unknown';
      logger.error(
        `Attachment upstream fetch failed messageId=${messageId} error=${fetchError} cause=${e.cause || 'none'}`,
      );
      if (e?.name === 'AbortError') {
        logger.error(
          `Attachment upstream fetch aborted messageId=${messageId} name=${e.name} message=${e.message ?? ''}`,
        );
        if (!res.headersSent) {
          return res.status(502).json({ success: false, message: 'Could not retrieve file (timeout)' });
        }
        return;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!upstream.ok) {
      logger.error(`Attachment upstream ${upstream.status} for message ${messageId} URL: ${message.fileUrl}`);
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
    const sizeLimitStream = new SizeLimitStream(MAX_ATTACHMENT_BYTES, messageId);

    try {
      await pipeline(nodeReadable, sizeLimitStream, res);
    } catch (pipeErr) {
      const err = pipeErr as { message?: string };
      if (err?.message?.includes('Size limit exceeded')) {
        logger.error(`Attachment size limit exceeded messageId=${messageId}`);
        if (!res.headersSent) {
          return res.status(413).json({ success: false, message: 'File too large' });
        }
        res.destroy();
        return;
      }
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
