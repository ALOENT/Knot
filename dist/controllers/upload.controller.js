"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = void 0;
const cloudinary_1 = require("cloudinary");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const stream_1 = require("stream");
cloudinary_1.v2.config({
    cloud_name: env_1.env.CLOUDINARY_CLOUD_NAME,
    api_key: env_1.env.CLOUDINARY_API_KEY,
    api_secret: env_1.env.CLOUDINARY_SECRET,
});
const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const { buffer, originalname, mimetype: multerMime } = req.file;
        // Security - Content-based MIME-type check (Security Audit item)
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        // Dynamic import for file-type (ESM)
        const { fromBuffer } = await eval('import("file-type")');
        const detectedType = await fromBuffer(buffer);
        const finalMime = detectedType ? detectedType.mime : multerMime;
        if (!allowedMimeTypes.includes(finalMime)) {
            return res.status(400).json({ success: false, message: 'Invalid file content type' });
        }
        // Use upload_stream for memory storage adapter with robust piping
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder: 'knot_chat_uploads',
                resource_type: 'auto',
                public_id: `${Date.now()}_${originalname.replace(/[^a-zA-Z0-9_.-]/g, '')}`,
            }, (error, result) => {
                if (error) {
                    logger_1.logger.error('Cloudinary upload_stream callback error', error);
                    return reject(error);
                }
                resolve(result);
            });
            // Create a readable stream from buffer and pipe it to Cloudinary
            const readableStream = new stream_1.Readable();
            readableStream._read = () => { };
            readableStream.push(buffer);
            readableStream.push(null);
            readableStream.on('error', (err) => {
                logger_1.logger.error('Readable stream error during upload', err);
                reject(err);
            });
            readableStream.pipe(uploadStream);
        });
        return res.status(200).json({
            success: true,
            fileUrl: uploadResult.secure_url,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to upload file to Cloudinary', error);
        return res.status(500).json({ success: false, message: 'File upload failed' });
    }
};
exports.uploadFile = uploadFile;
