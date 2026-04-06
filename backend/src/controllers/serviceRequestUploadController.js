const asyncHandler = require('express-async-handler');
const multer = require('multer');

const cloudinary = require('../config/cloudinary');
const ServiceRequest = require('../models/ServiceRequest');

const uploadPrescription = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function looksLikePdf(file) {
  if (!file) return false;
  const name = (file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (mime === 'application/pdf') return true;
  if (mime === 'application/octet-stream' && name.endsWith('.pdf')) return true;
  return name.endsWith('.pdf');
}

const postPrescriptionUpload = asyncHandler(async (req, res) => {
  const requestId = req.params?.id;
  if (!requestId) {
    return res.status(400).json({ success: false, message: 'Service request id required' });
  }
  const request = await ServiceRequest.findById(requestId);
  if (!request) {
    return res.status(404).json({ success: false, message: 'Service request not found' });
  }

  const uid = req.user?._id?.toString() ?? '';
  const isAdmin = req.user?.role === 'admin';
  const isAssignedStaff = request.assignedStaff && request.assignedStaff.toString() === uid;
  if (!isAdmin && !isAssignedStaff) {
    return res.status(403).json({ success: false, message: 'Not authorized to upload prescription' });
  }

  const f = req.file;
  if (!f || !f.buffer) {
    return res.status(400).json({ success: false, message: 'File is required (field: file)' });
  }
  if (!looksLikePdf(f)) {
    return res.status(400).json({ success: false, message: 'Only PDF files are allowed' });
  }

  const configured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  if (!configured) {
    return res.status(500).json({ success: false, message: 'Cloudinary is not configured' });
  }

  const folder = 'pawsewa/prescriptions';
  const publicId = `rx_${requestId}_${Date.now()}`;
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'raw',
      },
      (err, r) => {
        if (err) return reject(err);
        resolve(r);
      }
    );
    stream.end(f.buffer);
  });

  request.prescriptionUrl = result.secure_url;
  await request.save();

  res.status(201).json({
    success: true,
    message: 'Prescription uploaded',
    data: {
      prescriptionUrl: request.prescriptionUrl,
    },
  });
});

module.exports = {
  uploadPrescription,
  postPrescriptionUpload,
};

