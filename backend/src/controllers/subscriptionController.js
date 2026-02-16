const asyncHandler = require('express-async-handler');
const Subscription = require('../models/Subscription');
const Hostel = require('../models/Hostel');
const User = require('../models/User');
const mongoose = require('mongoose');

const PROVIDER_ROLES = ['hostel_owner', 'service_provider', 'admin'];

function getPlanConfig(plan) {
  return Subscription.getPlanConfig(plan);
}

/**
 * @desc    Get available subscription plans
 * @route   GET /api/v1/subscriptions/plans
 * @access  Public
 */
const getPlans = asyncHandler(async (req, res) => {
  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      maxListings: 5,
      maxPhotos: 3,
      isFeatured: false,
      platformFeePercent: 15,
      monthlyPrice: 500,
      yearlyPrice: 5000,
      monthlyPriceId: 'basic_monthly',
      yearlyPriceId: 'basic_yearly',
    },
    {
      id: 'premium',
      name: 'Premium',
      maxListings: -1,
      maxPhotos: -1,
      isFeatured: true,
      platformFeePercent: 5,
      monthlyPrice: 1500,
      yearlyPrice: 15000,
      monthlyPriceId: 'premium_monthly',
      yearlyPriceId: 'premium_yearly',
    },
  ];
  res.json({ success: true, data: plans });
});

/**
 * @desc    Get my subscription status
 * @route   GET /api/v1/subscriptions/my
 * @access  Private / provider
 */
const getMySubscription = asyncHandler(async (req, res) => {
  if (!PROVIDER_ROLES.includes(req.user.role) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Only providers can access subscription');
  }
  const sub = await Subscription.findOne({ providerId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  const now = new Date();
  const isActive = sub && sub.status === 'active' && sub.validUntil && new Date(sub.validUntil) > now;
  const planConfig = sub ? getPlanConfig(sub.plan) : null;
  res.json({
    success: true,
    data: {
      subscription: sub,
      isActive,
      planConfig,
      canList: isActive,
    },
  });
});

/**
 * @desc    Check if provider has valid subscription and activate listings
 * @access  Internal
 */
async function ensureProviderSubscription(providerId) {
  const sub = await Subscription.findOne({
    providerId,
    status: 'active',
    validUntil: { $gt: new Date() },
  }).lean();
  return !!sub;
}

/**
 * @desc    Get platform fee percent for a provider
 * @access  Internal
 */
async function getPlatformFeePercent(providerId) {
  const sub = await Subscription.findOne({
    providerId,
    status: 'active',
    validUntil: { $gt: new Date() },
  }).lean();
  if (sub) {
    return getPlanConfig(sub.plan).platformFeePercent;
  }
  return 15; // default for unsubscribed
}

/**
 * @desc    Initiate subscription payment (Khalti)
 * @route   POST /api/v1/subscriptions/initiate
 * @access  Private / provider
 */
const initiateSubscriptionPayment = asyncHandler(async (req, res) => {
  if (!PROVIDER_ROLES.includes(req.user.role) && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Only providers can subscribe');
  }
  if (req.user.role !== 'admin' && !req.user.businessLicenseVerified) {
    res.status(403);
    throw new Error('Your business license must be verified by admin before you can subscribe. Please submit a provider application.');
  }
  const { plan, billingCycle } = req.body || {};
  if (!plan || !['basic', 'premium'].includes(plan)) {
    res.status(400);
    throw new Error('Valid plan (basic or premium) required');
  }
  if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
    res.status(400);
    throw new Error('Valid billingCycle (monthly or yearly) required');
  }

  const config = getPlanConfig(plan);
  const amount = billingCycle === 'yearly' ? config.yearlyPrice : config.monthlyPrice;
  if (amount < 10) {
    res.status(400);
    throw new Error('Invalid subscription amount');
  }

  const { initiateSubscriptionKhalti } = require('./paymentController');
  const result = await initiateSubscriptionKhalti({
    userId: req.user._id,
    plan,
    billingCycle,
    amount,
  });
  res.json({
    success: true,
    data: {
      paymentUrl: result.paymentUrl,
      pidx: result.pidx,
      subscriptionId: result.subscriptionId,
      amount: result.amount,
      successUrl: result.successUrl,
    },
  });
});

module.exports = {
  getPlans,
  getMySubscription,
  initiateSubscriptionPayment,
  ensureProviderSubscription,
  getPlatformFeePercent,
  getPlanConfig,
};
