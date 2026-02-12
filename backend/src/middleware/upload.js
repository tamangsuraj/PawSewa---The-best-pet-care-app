const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
];

const imageExtensions = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;

const imageFileFilter = (req, file, cb) => {
  const isImageMime =
    allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('image/');
  // Flutter Dio often sends files as application/octet-stream; accept if filename looks like an image
  const isImageFilename =
    file.originalname && imageExtensions.test(file.originalname);
  if (isImageMime || isImageFilename) {
    cb(null, true);
  } else {
    console.error('Rejected file with mimetype:', file.mimetype, 'originalname:', file.originalname);
    cb(new Error('Only image files are allowed'), false);
  }
};

// Product images: accept image/* OR application/octet-stream (Flutter often sends this with no extension in filename)
const productImageFileFilter = (req, file, cb) => {
  const isImageMime =
    allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('image/');
  const isImageFilename = file.originalname && imageExtensions.test(file.originalname);
  const isOctetStream = file.mimetype === 'application/octet-stream';
  if (isImageMime || isImageFilename || isOctetStream) {
    cb(null, true);
  } else {
    console.error('Rejected product image:', file.mimetype, file.originalname);
    cb(new Error('Only image files are allowed'), false);
  }
};

// Pet photo upload: stream directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pawsewa/pets',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }],
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// Product images: memory storage so controller can upload to Cloudinary and handle failures (e.g. Stale request)
const memoryStorage = multer.memoryStorage();
const uploadProductImages = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for mobile-compressed images
  fileFilter: productImageFileFilter,
});

module.exports = upload;
module.exports.uploadProductImages = uploadProductImages;
module.exports.allowedMimeTypes = allowedMimeTypes;
