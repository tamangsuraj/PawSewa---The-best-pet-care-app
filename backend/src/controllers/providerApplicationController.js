const asyncHandler = require('express-async-handler');
const ProviderApplication = require('../models/ProviderApplication');
const User = require('../models/User');

/**
 * @desc    Create provider application (pending approval)
 * @route   POST /api/v1/provider-applications
 * @access  Private
 */
const createApplication = asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!['hostel_owner', 'service_provider'].includes(req.user.role)) {
    res.status(403);
    throw new Error('Only providers can apply');
  }
  const existing = await ProviderApplication.findOne({
    userId: req.user._id,
    status: 'pending',
  });
  if (existing) {
    res.status(400);
    throw new Error('You already have a pending application');
  }
  const app = await ProviderApplication.create({
    userId: req.user._id,
    businessName: body.businessName || req.user.facilityName || req.user.name,
    businessLicense: body.businessLicense || req.user.businessLicense,
    businessLicenseUrl: body.businessLicenseUrl,
    serviceTypes: Array.isArray(body.serviceTypes) ? body.serviceTypes : ['Hostel'],
  });
  res.status(201).json({
    success: true,
    message: 'Application submitted. Admin will verify your business license.',
    data: app,
  });
});

/**
 * @desc    Get my application status
 * @route   GET /api/v1/provider-applications/my
 * @access  Private
 */
const getMyApplication = asyncHandler(async (req, res) => {
  const app = await ProviderApplication.findOne({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: app });
});

/**
 * @desc    Admin: List pending applications
 * @route   GET /api/v1/provider-applications/pending
 * @access  Private / admin
 */
const getPendingApplications = asyncHandler(async (req, res) => {
  const apps = await ProviderApplication.find({ status: 'pending' })
    .populate('userId', 'name email phone businessLicense')
    .sort({ createdAt: 1 })
    .lean();
  res.json({ success: true, data: apps });
});

/**
 * @desc    Admin: Approve or reject application
 * @route   PATCH /api/v1/provider-applications/:id/review
 * @access  Private / admin
 */
const reviewApplication = asyncHandler(async (req, res) => {
  const { approve, rejectionReason } = req.body || {};
  const app = await ProviderApplication.findById(req.params.id).populate('userId');
  if (!app) {
    res.status(404);
    throw new Error('Application not found');
  }
  if (app.status !== 'pending') {
    res.status(400);
    throw new Error('Application already reviewed');
  }
  app.status = approve ? 'approved' : 'rejected';
  app.reviewedBy = req.user._id;
  app.reviewedAt = new Date();
  if (!approve && rejectionReason) app.rejectionReason = rejectionReason;
  await app.save();

  if (approve && app.userId) {
    await User.findByIdAndUpdate(app.userId._id, {
      businessLicenseVerified: true,
    });
  }

  res.json({
    success: true,
    message: approve ? 'Application approved' : 'Application rejected',
    data: app,
  });
});

module.exports = {
  createApplication,
  getMyApplication,
  getPendingApplications,
  reviewApplication,
};
