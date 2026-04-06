const asyncHandler = require('express-async-handler');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

function inferMediaType(mimetype) {
  if (!mimetype || typeof mimetype !== 'string') return null;
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return null;
}

/**
 * POST /api/v1/chat/upload (multipart field: file)
 * Returns { url, mediaType, publicId } for Socket.io send_message / REST.
 */
const postChatUpload = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ success: false, message: 'file is required (multipart field: file)' });
  }

  const configured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  if (!configured) {
    return res.status(503).json({
      success: false,
      message: 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in backend/.env.',
    });
  }

  const mediaType = inferMediaType(req.file.mimetype);
  if (!mediaType) {
    return res.status(400).json({ success: false, message: 'Only image and video uploads are allowed' });
  }

  const resourceType = mediaType === 'video' ? 'video' : 'image';

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'pawsewa_chat',
        resource_type: resourceType,
      },
      (err, r) => {
        if (err) reject(err);
        else resolve(r);
      }
    );
    stream.end(req.file.buffer);
  });

  res.status(201).json({
    success: true,
    data: {
      url: result.secure_url,
      mediaType,
      publicId: result.public_id,
    },
  });
});

module.exports = { upload, postChatUpload };
