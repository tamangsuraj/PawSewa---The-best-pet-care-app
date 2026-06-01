const asyncHandler = require('express-async-handler');
const axios = require('axios');
const PetOwnerSubscription = require('../models/PetOwnerSubscription');
const Payment = require('../models/Payment');
const User = require('../models/User');
const {
  KHALTI_BASE_URL,
  KHALTI_SECRET_KEY,
  nprToPaisa,
  isKhaltiConfigured,
  getServerBaseUrl,
} = require('../config/payment_config');

const PLANS = [
  {
    id: 'basic_monthly',
    name: 'Basic Monthly',
    price: 999,
    cycle: 'monthly',
    services: ['1 home consultation/month', 'Vaccination reminders'],
  },
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    price: 1799,
    cycle: 'monthly',
    services: [
      '3 home consultations/month',
      'Vaccination + deworming reminders',
      'Priority vet assignment',
    ],
  },
  {
    id: 'basic_annual',
    name: 'Basic Annual',
    price: 9999,
    cycle: 'annual',
    services: ['12 home consultations/year', 'Vaccination reminders', '2 months free'],
  },
  {
    id: 'premium_annual',
    name: 'Premium Annual',
    price: 17999,
    cycle: 'annual',
    services: ['36 home consultations/year', 'All reminders', 'Priority vet', '2 months free'],
  },
];

function planMeta(planId) {
  return PLANS.find((p) => p.id === planId) || null;
}

function computeEndDate(startDate, cycle) {
  const endDate = new Date(startDate);
  if (cycle === 'annual') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }
  return endDate;
}

async function assertNoConflictingSubscription(userId, plan) {
  const existing = await PetOwnerSubscription.findOne({
    user: userId,
    plan,
    status: { $in: ['active', 'pending_payment', 'cancelling'] },
    endDate: { $gt: new Date() },
  });
  if (existing) {
    const err = new Error(
      existing.status === 'pending_payment'
        ? 'You already have a pending payment for this plan'
        : 'You already have an active subscription for this plan'
    );
    err.statusCode = 409;
    throw err;
  }
}

/**
 * Activate pet-owner subscription after verified payment (Khalti).
 * @param {object} opts
 * @param {import('mongoose').ClientSession} [opts.session]
 */
async function activatePetOwnerSubscription({ userId, plan, paymentRef, paymentMethod, session }) {
  const meta = planMeta(plan);
  if (!meta) {
    throw new Error('Invalid subscription plan');
  }

  const q = { user: userId, plan, status: { $in: ['active', 'cancelling'] }, endDate: { $gt: new Date() } };
  const existing = session
    ? await PetOwnerSubscription.findOne(q).session(session)
    : await PetOwnerSubscription.findOne(q);
  if (existing) {
    const err = new Error('You already have an active subscription for this plan');
    err.statusCode = 409;
    throw err;
  }

  const pending = session
    ? await PetOwnerSubscription.findOne({ user: userId, plan, status: 'pending_payment' }).session(session)
    : await PetOwnerSubscription.findOne({ user: userId, plan, status: 'pending_payment' });

  const startDate = new Date();
  const endDate = computeEndDate(startDate, meta.cycle);

  if (pending) {
    pending.status = 'active';
    pending.startDate = startDate;
    pending.endDate = endDate;
    pending.paymentRef = paymentRef;
    pending.paymentMethod = paymentMethod || pending.paymentMethod;
    await pending.save({ session });
    return pending;
  }

  const createOpts = session ? { session } : {};
  const [sub] = await PetOwnerSubscription.create(
    [
      {
        user: userId,
        plan,
        billingCycle: meta.cycle,
        startDate,
        endDate,
        status: 'active',
        price: meta.price,
        paymentRef: String(paymentRef),
        paymentMethod: paymentMethod || 'khalti',
      },
    ],
    createOpts
  );
  return sub;
}

const getPlans = asyncHandler(async (req, res) => {
  res.json({ success: true, data: PLANS });
});

const getMySubscription = asyncHandler(async (req, res) => {
  const sub = await PetOwnerSubscription.findOne({
    user: req.user._id,
    status: { $in: ['active', 'cancelling', 'pending_payment'] },
    $or: [{ endDate: { $gt: new Date() } }, { status: 'pending_payment' }],
  })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: sub });
});

/**
 * POST /api/v1/pet-subscriptions/khalti/initiate
 * Body: { plan }
 */
const initiateKhalti = asyncHandler(async (req, res) => {
  const { plan } = req.body || {};
  const meta = planMeta(plan);
  if (!meta) {
    return res.status(400).json({ success: false, message: 'Invalid subscription plan' });
  }
  if (!isKhaltiConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Khalti is not configured. Set KHALTI_SECRET_KEY and KHALTI_BASE_URL.',
    });
  }

  await assertNoConflictingSubscription(req.user._id, plan);

  const amountNpr = meta.price;
  const amountPaisa = nprToPaisa(amountNpr);
  if (amountPaisa < 1000) {
    return res.status(400).json({
      success: false,
      message: 'Amount should be greater than Rs. 10 (1000 paisa)',
    });
  }

  const user = await User.findById(req.user._id).select('name email phone').lean();
  const payment = await Payment.create({
    user: req.user._id,
    targetType: 'pet_owner_subscription',
    amount: amountNpr,
    currency: 'NPR',
    gateway: 'khalti',
    status: 'pending',
    metadata: { plan },
  });

  const baseUrl = getServerBaseUrl();
  const returnUrl = `${baseUrl}/api/v1/payments/khalti/callback`;
  const payload = {
    return_url: returnUrl,
    website_url: baseUrl,
    amount: amountPaisa,
    purchase_order_id: payment._id.toString(),
    purchase_order_name: `PawSewa Pro — ${meta.name}`,
    customer_info: {
      name: (user && user.name) || 'Customer',
      email: (user && user.email) || '',
      phone: (user && user.phone) || '',
    },
  };

  const resp = await axios.post(`${KHALTI_BASE_URL}/epayment/initiate/`, payload, {
    headers: {
      Authorization: `Key ${KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  const { pidx, payment_url } = resp.data || {};
  if (!pidx || !payment_url) {
    return res.status(502).json({ success: false, message: 'Khalti did not return pidx or payment_url' });
  }

  payment.gatewayTransactionId = pidx;
  payment.rawGatewayPayload = resp.data || {};
  await payment.save();

  res.json({
    success: true,
    data: {
      paymentId: payment._id,
      pidx,
      paymentUrl: payment_url,
      successUrl: `${baseUrl}/api/v1/payments/payment-success`,
      amount: amountNpr,
      plan,
      planName: meta.name,
    },
  });
});

/**
 * POST /api/v1/pet-subscriptions/fonepay/initiate
 * Body: { plan }
 */
const initiateFonepay = asyncHandler(async (req, res) => {
  const { plan } = req.body || {};
  const meta = planMeta(plan);
  if (!meta) {
    return res.status(400).json({ success: false, message: 'Invalid subscription plan' });
  }

  await assertNoConflictingSubscription(req.user._id, plan);

  const referenceId = `PSW-SUB-${Date.now().toString(36).toUpperCase()}`;
  const startDate = new Date();
  const endDate = computeEndDate(startDate, meta.cycle);

  const sub = await PetOwnerSubscription.create({
    user: req.user._id,
    plan,
    billingCycle: meta.cycle,
    startDate,
    endDate,
    status: 'pending_payment',
    price: meta.price,
    paymentMethod: 'fonepay',
    paymentRef: referenceId,
  });

  res.status(201).json({
    success: true,
    data: {
      subscriptionId: sub._id,
      referenceId,
      amount: meta.price,
      plan,
      planName: meta.name,
      message:
        'Complete payment in the Fonepay app using the reference below. Your plan activates after we verify payment.',
    },
  });
});

/**
 * Legacy subscribe — only accepts verified Khalti pidx tied to a completed Payment.
 * Prefer khalti/initiate + verify flow from the mobile app.
 */
const subscribe = asyncHandler(async (req, res) => {
  const { plan, paymentRef } = req.body || {};
  const meta = planMeta(plan);
  if (!meta) {
    res.status(400);
    throw new Error('Invalid subscription plan');
  }
  if (!paymentRef) {
    res.status(400);
    throw new Error('paymentRef is required');
  }
  if (String(paymentRef).startsWith('manual_')) {
    res.status(400);
    throw new Error('Complete payment via Khalti or Fonepay before subscribing');
  }

  const payment = await Payment.findOne({
    user: req.user._id,
    gatewayTransactionId: String(paymentRef),
    targetType: 'pet_owner_subscription',
    status: 'completed',
    'metadata.plan': plan,
  });
  if (!payment) {
    res.status(402);
    throw new Error('Payment not verified. Complete Khalti payment first.');
  }

  const sub = await activatePetOwnerSubscription({
    userId: req.user._id,
    plan,
    paymentRef: String(paymentRef),
    paymentMethod: 'khalti',
  });

  res.status(201).json({ success: true, data: sub, message: 'Subscription activated' });
});

const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await PetOwnerSubscription.findOne({
    user: req.user._id,
    status: 'active',
    endDate: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!sub) {
    res.status(404);
    throw new Error('No active subscription found');
  }

  sub.status = 'cancelling';
  await sub.save();

  const endLabel = sub.endDate.toISOString().slice(0, 10);
  res.json({
    success: true,
    data: sub,
    message: `Cancelling — active until ${endLabel}`,
  });
});

module.exports = {
  getPlans,
  getMySubscription,
  initiateKhalti,
  initiateFonepay,
  subscribe,
  cancelSubscription,
  activatePetOwnerSubscription,
  PLANS,
};
