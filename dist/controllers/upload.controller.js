"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = void 0;
const cloudinary_1 = require("cloudinary");
const logger_1 = require("../utils/logger");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET,
});
const ALLOWED_MIME_TYPES = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'video/mp4': 'video',
    'application/pdf': 'raw',
    'application/msword': 'raw',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'raw',
    'text/plain': 'raw',
};
const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file provided' });
        }
        const mimeType = req.file.mimetype;
        const resourceType = ALLOWED_MIME_TYPES[mimeType];
        if (!resourceType) {
            return res.status(400).json({ success: false, message: 'File type not allowed' });
        }
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'File size exceeds 10MB' });
        }
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder: 'knot_chat_uploads',
                resource_type: resourceType,
                use_filename: true,
                unique_filename: true,
            }, (error, result) => {
                if (error) {
                    logger_1.logger.error('Cloudinary upload error', error);
                    reject(error);
                }
                else {
                    resolve(result);
                }
            });
            uploadStream.end(req.file.buffer);
        });
        return res.status(200).json({
            success: true,
            fileUrl: uploadResult.secure_url,
            resourceType,
            originalName: req.file.originalname,
            fileSize: req.file.size,
        });
    }
    catch (error) {
        logger_1.logger.error('Upload failed', error);
        return res.status(500).json({ success: false, message: 'Upload failed' });
    }
};
exports.uploadFile = uploadFile;
