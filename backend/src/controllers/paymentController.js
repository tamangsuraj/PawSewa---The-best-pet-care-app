const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const CareRequest = require('../models/CareRequest');
const CareBooking = require('../models/CareBooking');
const Subscription = require('../models/Subscription');
const Hostel = require('../models/Hostel');
const Order = require('../models/Order');
const PaymentLog = require('../models/PaymentLog');
const {
  KHALTI_BASE_URL,
  KHALTI_SECRET_KEY,
  nprToPaisa,
  isKhaltiConfigured,
  getPaymentFailureMessage,
} = require('../config/payment_config');

const ESEWA_INIT_URL = process.env.ESEWA_INIT_URL || '';
const ESEWA_VERIFY_SECRET = process.env.ESEWA_SECRET_KEY || '';
const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || '';
// Optional server-to-server verification endpoint for eSewa.
// Example (check latest docs): https://epay.esewa.com.np/api/epay/transaction/status/
const ESEWA_VERIFY_URL = process.env.ESEWA_VERIFY_URL || '';

/**
 * Helper: promote ServiceRequest to \"confirmed\" + mark paymentStatus
 * in a single DB transaction.
 */
async function markPaymentCompleted({ paymentId }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) {
        throw new Error('Payment not found');
      }
      payment.status = 'completed';
      await payment.save({ session });

      if (payment.targetType === 'service') {
        const req = await ServiceRequest.findById(payment.serviceRequest).session(
          session
        );
        if (!req) {
          throw new Error('Service request not found');
        }
        req.paymentStatus = 'paid';
        req.paymentGateway = payment.gateway;
        // req.status = 'confirmed'; // optional
        await req.save({ session });
      } else if (payment.targetType === 'care') {
        const care = await CareRequest.findById(payment.careRequest).session(
          session
        );
        if (!care) {
          throw new Error('Care request not found');
        }
        care.paymentStatus = 'paid';
        care.status = 'pending_review';
        await care.save({ session });
      } else if (payment.targetType === 'care_booking' && payment.careBooking) {
        const booking = await CareBooking.findById(payment.careBooking).session(
          session
        );
        if (!booking) {
          throw new Error('Care booking not found');
        }
        booking.paymentStatus = 'paid';
        booking.status = 'paid';
        await booking.save({ session });
      } else if (payment.targetType === 'subscription' && payment.metadata) {
        const { plan, billingCycle } = payment.metadata;
        if (!plan || !billingCycle) {
          throw new Error('Subscription metadata missing');
        }
        const now = new Date();
        let validUntil = new Date(now);
        if (billingCycle === 'monthly') {
          validUntil.setMonth(validUntil.getMonth() + 1);
        } else {
          validUntil.setFullYear(validUntil.getFullYear() + 1);
        }
        const sub = await Subscription.create([{
          providerId: payment.user,
          plan,
          billingCycle,
          status: 'active',
          validFrom: now,
          validUntil,
          amountPaid: payment.amount,
          gatewayTransactionId: payment.gatewayTransactionId,
        }], { session });
        await Hostel.updateMany(
          { ownerId: payment.user },
          { $set: { isActive: true } },
          { session }
        );
      }
    });
  } finally {
    session.endSession();
  }
}

/**
 * Initiate Khalti payment for a care booking. Throws on error.
 * @returns {Promise<{ paymentUrl: string, pidx: string, paymentId: string, amount: number }>}
 */
async function initiateCareBookingKhalti({ userId, careBookingId }) {
  if (!isKhaltiConfigured()) {
    const err = new Error('Khalti is not configured');
    err.statusCode = 503;
    throw err;
  }
  const booking = await CareBooking.findById(careBookingId)
    .populate('userId', 'name email phone')
    .lean();
  if (!booking) {
    const err = new Error('Care booking not found');
    err.statusCode = 404;
    throw err;
  }
  const bookingUserId = booking.userId?._id?.toString() || booking.userId?.toString();
  if (bookingUserId !== userId.toString()) {
    const err = new Error('Not your booking');
    err.statusCode = 403;
    throw err;
  }
  if (booking.paymentStatus === 'paid') {
    const err = new Error('Booking is already paid');
    err.statusCode = 400;
    throw err;
  }
  const amountNpr = Number(booking.totalAmount) || 0;
  if (amountNpr < 0.1) {
    const err = new Error('Invalid booking amount');
    err.statusCode = 400;
    throw err;
  }
  const amountPaisa = nprToPaisa(amountNpr);
  if (amountPaisa < 1000) {
    const err = new Error('Amount should be greater than Rs. 10 (1000 paisa)');
    err.statusCode = 400;
    throw err;
  }
  const payment = await Payment.create({
    user: userId,
    careBooking: careBookingId,
    targetType: 'care_booking',
    amount: amountNpr,
    currency: 'NPR',
    gateway: 'khalti',
    status: 'pending',
  });
  const baseUrl = process.env.BASE_URL || process.env.KHALTI_RETURN_BASE || 'http://localhost:3000';
  const returnUrl = `${baseUrl}/api/v1/payments/khalti/callback`;
  const payload = {
    return_url: returnUrl,
    website_url: baseUrl,
    amount: amountPaisa,
    purchase_order_id: payment._id.toString(),
    purchase_order_name: `Pet Hostel Booking #${String(careBookingId).slice(-6)}`,
    customer_info: {
      name: (booking.userId && booking.userId.name) || 'Customer',
      email: (booking.userId && booking.userId.email) || '',
      phone: (booking.userId && booking.userId.phone) || '',
    },
  };
  const resp = await axios.post(
    `${KHALTI_BASE_URL}/epayment/initiate/`,
    payload,
    {
      headers: {
        Authorization: `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const { pidx, payment_url } = resp.data || {};
  if (!pidx || !payment_url) {
    const err = new Error('Khalti did not return pidx or payment_url');
    err.statusCode = 502;
    throw err;
  }
  payment.gatewayTransactionId = pidx;
  payment.rawGatewayPayload = resp.data || {};
  await payment.save();
  return {
    paymentUrl: payment_url,
    pidx,
    paymentId: payment._id,
    amount: amountNpr,
    successUrl: `${baseUrl}/api/v1/payments/payment-success`,
    careBookingId: careBookingId.toString(),
  };
}

/**
 * Initiate Khalti payment for provider subscription.
 */
async function initiateSubscriptionKhalti({ userId, plan, billingCycle, amount }) {
  if (!isKhaltiConfigured()) {
    const err = new Error('Khalti is not configured');
    err.statusCode = 503;
    throw err;
  }
  const amountPaisa = nprToPaisa(amount);
  if (amountPaisa < 1000) {
    const err = new Error('Amount should be greater than Rs. 10 (1000 paisa)');
    err.statusCode = 400;
    throw err;
  }
  const user = await require('../models/User').findById(userId).select('name email phone').lean();
  const payment = await Payment.create({
    user: userId,
    targetType: 'subscription',
    amount,
    currency: 'NPR',
    gateway: 'khalti',
    status: 'pending',
    metadata: { plan, billingCycle },
  });
  const baseUrl = process.env.BASE_URL || process.env.KHALTI_RETURN_BASE || 'http://localhost:3000';
  const returnUrl = `${baseUrl}/api/v1/payments/khalti/callback`;
  const payload = {
    return_url: returnUrl,
    website_url: baseUrl,
    amount: amountPaisa,
    purchase_order_id: payment._id.toString(),
    purchase_order_name: `PawSewa Subscription - ${plan} ${billingCycle}`,
    customer_info: {
      name: (user && user.name) || 'Provider',
      email: (user && user.email) || '',
      phone: (user && user.phone) || '',
    },
  };
  const resp = await axios.post(
    `${KHALTI_BASE_URL}/epayment/initiate/`,
    payload,
    {
      headers: {
        Authorization: `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const { pidx, payment_url } = resp.data || {};
  if (!pidx || !payment_url) {
    const err = new Error('Khalti did not return pidx or payment_url');
    err.statusCode = 502;
    throw err;
  }
  payment.gatewayTransactionId = pidx;
  payment.rawGatewayPayload = resp.data || {};
  await payment.save();
  return {
    paymentUrl: payment_url,
    pidx,
    subscriptionId: payment._id,
    amount,
    successUrl: `${baseUrl}/api/v1/payments/payment-success`,
  };
}

/**
 * POST /api/v1/payments/khalti/initiate
 * Body: { serviceRequestId, amount }
 */
const initiateKhalti = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  const { serviceRequestId, amount } = req.body || {};
  if (!serviceRequestId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'serviceRequestId and positive amount (NPR) are required',
    });
  }

  const serviceRequest = await ServiceRequest.findById(serviceRequestId).select(
    'user status'
  );
  if (!serviceRequest) {
    return res.status(404).json({ success: false, message: 'Service request not found' });
  }
  if (serviceRequest.user.toString() !== userId.toString()) {
    return res.status(403).json({ success: false, message: 'Not allowed for this request' });
  }

  if (!isKhaltiConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Khalti is not configured. Set KHALTI_SECRET_KEY and KHALTI_BASE_URL.',
    });
  }

  // Amount in paisa (Amount * 100) per Khalti spec
  const amountPaisa = nprToPaisa(amount);

  // Create a Payment record first
  const payment = await Payment.create({
    user: userId,
    serviceRequest: serviceRequestId,
    targetType: 'service',
    amount,
    currency: 'NPR',
    gateway: 'khalti',
    status: 'pending',
  });

  const payload = {
    return_url: process.env.KHALTI_RETURN_URL || 'https://example.com/pay/khalti/return',
    website_url: process.env.KHALTI_WEBSITE_URL || 'https://example.com',
    amount: amountPaisa,
    purchase_order_id: payment._id.toString(),
    purchase_order_name: `Service Request ${serviceRequestId}`,
  };

  const resp = await axios.post(
    `${KHALTI_BASE_URL}/epayment/initiate/`,
    payload,
    {
      headers: {
        Authorization: `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const { pidx, payment_url } = resp.data || {};
  payment.gatewayTransactionId = pidx;
  payment.rawGatewayPayload = resp.data || {};
  await payment.save();

  res.json({
    success: true,
    data: {
      paymentId: payment._id,
      pidx,
      paymentUrl: payment_url,
    },
  });
});

/**
 * GET /api/v1/payments/khalti/verify?pidx=...&paymentId=...
 */
const verifyKhalti = asyncHandler(async (req, res) => {
  const { pidx, paymentId } = req.query || {};
  if (!pidx || !paymentId) {
    return res.status(400).json({ success: false, message: 'Missing pidx or paymentId' });
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }

  if (!isKhaltiConfigured()) {
    return res.status(503).json({ success: false, message: 'Khalti is not configured' });
  }

  const resp = await axios.post(
    `${KHALTI_BASE_URL}/epayment/lookup/`,
    { pidx },
    {
      headers: {
        Authorization: `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const status = resp.data?.status;
  payment.rawGatewayPayload = resp.data || {};

  if (status === 'Completed') {
    await markPaymentCompleted({ paymentId: payment._id });
    return res.json({ success: true, message: 'Payment completed' });
  }

  payment.status = 'failed';
  await payment.save();
  return res.status(400).json({
    success: false,
    message: `Payment not completed (status: ${status})`,
  });
});

/**
 * GET /api/v1/payments/khalti/callback
 * Khalti redirects the user here after payment. Query: pidx, status, purchase_order_id, etc.
 * We lookup pidx; if Completed and purchase_order_id is an order ID, mark order as paid.
 * Then redirect to success page or app deep link.
 */
const khaltiCallback = asyncHandler(async (req, res) => {
  const { pidx, status: callbackStatus, purchase_order_id: purchaseOrderId } = req.query || {};
  if (!pidx) {
    return res.redirect(
      process.env.KHALTI_FAIL_REDIRECT || `${process.env.BASE_URL || 'http://localhost:3000'}/payment-failed?reason=missing_pidx`
    );
  }

  let lookupStatus = callbackStatus;
  let lookupData = {};
  try {
    const lookupResp = await axios.post(
      `${KHALTI_BASE_URL}/epayment/lookup/`,
      { pidx },
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    lookupData = lookupResp.data || {};
    lookupStatus = lookupData.status;
  } catch (err) {
    console.error('[Khalti callback] Lookup failed:', err?.response?.data || err.message);
  }

  const amountPaisa = lookupData.amount != null ? Number(lookupData.amount) : 0;
  const amount = amountPaisa / 100;

  const base = process.env.BASE_URL || process.env.KHALTI_RETURN_BASE || 'http://localhost:3000';
  const successRedirect =
    process.env.KHALTI_SUCCESS_REDIRECT || `${base}/api/v1/payments/payment-success`;
  const failRedirect =
    process.env.KHALTI_FAIL_REDIRECT || `${base}/api/v1/payments/payment-failed`;

  let logType = 'order';
  if (lookupStatus === 'Completed' && purchaseOrderId) {
    const order = await Order.findById(purchaseOrderId);
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.paymentMethod = 'khalti';
      await order.save();
    }
    const payment = await Payment.findById(purchaseOrderId);
    if (payment && payment.status !== 'completed') {
      await markPaymentCompleted({ paymentId: payment._id });
      logType = payment.targetType || 'service';
    }
  }

  await PaymentLog.create({
    pidx,
    amount,
    amountPaisa,
    status: lookupStatus || 'unknown',
    purchaseOrderId: purchaseOrderId || '',
    type: logType,
    gateway: 'khalti',
    rawPayload: lookupData,
  }).catch((e) => console.error('[Khalti callback] PaymentLog create failed:', e.message));

  if (lookupStatus === 'Completed') {
    const orderId = purchaseOrderId || '';
    return res.redirect(`${successRedirect}?orderId=${orderId}`);
  }

  const friendlyReason = getPaymentFailureMessage(lookupStatus || 'unknown');
  return res.redirect(`${failRedirect}?reason=${encodeURIComponent(friendlyReason)}`);
});

/**
 * GET /payment-success - Simple HTML page after successful Khalti payment (for redirect target).
 * If PAYMENT_SUCCESS_WEB_URL is set (e.g. User Web URL), redirects there with orderId.
 */
const paymentSuccessPage = (req, res) => {
  const orderId = req.query?.orderId || '';
  const webUrl = process.env.PAYMENT_SUCCESS_WEB_URL || '';
  if (webUrl && webUrl.trim()) {
    const sep = webUrl.includes('?') ? '&' : '?';
    return res.redirect(`${webUrl.replace(/\/$/, '')}${sep}orderId=${orderId}`);
  }
  res.set('Content-Type', 'text/html');
  res.send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Successful</title></head><body style="font-family:sans-serif;max-width:360px;margin:60px auto;padding:24px;text-align:center;"><h2 style="color:#22c55e;">Payment Successful</h2><p>Thank you for your order. You can close this page and return to the PawSewa app.</p>${orderId ? `<p><small>Order ID: ${orderId}</small></p>` : ''}</body></html>`
  );
};

/**
 * GET /payment-failed - Simple HTML page after failed/cancelled payment.
 * reason query param may be raw Khalti status or pre-mapped friendly message.
 */
const paymentFailedPage = (req, res) => {
  const rawReason = req.query?.reason || '';
  const reason = rawReason ? getPaymentFailureMessage(rawReason) : 'Payment was not completed. Please try again.';
  res.set('Content-Type', 'text/html');
  res.send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Failed</title></head><body style="font-family:sans-serif;max-width:360px;margin:60px auto;padding:24px;text-align:center;"><h2 style="color:#ef4444;">Payment Failed</h2><p>${reason}</p><p>You can close this page and try again in the app.</p></body></html>`
  );
};

/**
 * POST /api/v1/payments/esewa/initiate
 * Body: { serviceRequestId, amount }
 * Returns a signed payload that the client can POST/redirect to eSewa.
 */
const initiateEsewa = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  const { serviceRequestId, amount } = req.body || {};
  if (!serviceRequestId || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'serviceRequestId and positive amount (NPR) are required',
    });
  }

  const serviceRequest = await ServiceRequest.findById(serviceRequestId).select(
    'user status'
  );
  if (!serviceRequest) {
    return res.status(404).json({ success: false, message: 'Service request not found' });
  }
  if (serviceRequest.user.toString() !== userId.toString()) {
    return res.status(403).json({ success: false, message: 'Not allowed for this request' });
  }

  const transaction_uuid = new mongoose.Types.ObjectId().toString();

  const payment = await Payment.create({
    user: userId,
    serviceRequest: serviceRequestId,
    amount,
    currency: 'NPR',
    gateway: 'esewa',
    status: 'pending',
    gatewayTransactionId: transaction_uuid,
  });

  const total_amount = amount.toFixed(2);
  const signaturePayload = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${ESEWA_PRODUCT_CODE}`;
  const signature = crypto
    .createHmac('sha256', ESEWA_VERIFY_SECRET)
    .update(signaturePayload)
    .digest('base64');

  // The client will POST this to eSewa
  res.json({
    success: true,
    data: {
      paymentId: payment._id,
      transaction_uuid,
      total_amount,
      product_code: ESEWA_PRODUCT_CODE,
      signature,
      redirect_url: ESEWA_INIT_URL,
    },
  });
});

/**
 * GET /api/v1/payments/esewa/verify
 * eSewa callback: ?data=<base64json>&signature=<base64>
 */
const verifyEsewa = asyncHandler(async (req, res) => {
  const { data, signature } = req.query || {};
  if (!data || !signature) {
    return res.status(400).json({ success: false, message: 'Missing data or signature' });
  }

  let decoded;
  try {
    const json = Buffer.from(String(data), 'base64').toString('utf-8');
    decoded = JSON.parse(json);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Invalid data payload' });
  }

  const { total_amount, transaction_uuid, product_code, status, paymentId } = decoded;
  const expectedPayload = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
  const expectedSignature = crypto
    .createHmac('sha256', ESEWA_VERIFY_SECRET)
    .update(expectedPayload)
    .digest('base64');

  if (signature !== expectedSignature) {
    return res.status(403).json({ success: false, message: 'Signature verification failed' });
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment not found' });
  }

  payment.rawGatewayPayload = decoded;

  // Optional additional server-to-server verification with eSewa before
  // marking the payment as completed. This ensures we never rely solely
  // on client-provided success flags.
  if (status === 'COMPLETE') {
    // Cross-check amount against our Payment record
    const decodedAmount = Number(total_amount);
    const recordedAmount = Number(payment.amount);
    if (!Number.isFinite(decodedAmount) || decodedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount in callback payload',
      });
    }
    if (Number.isFinite(recordedAmount) && recordedAmount > 0 && decodedAmount !== recordedAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount mismatch between eSewa and our records',
      });
    }

    // If a verify URL is configured, call eSewa directly to confirm
    if (ESEWA_VERIFY_URL) {
      try {
        const verifyResp = await axios.post(
          ESEWA_VERIFY_URL,
          {
            product_code: product_code || ESEWA_PRODUCT_CODE,
            total_amount,
            transaction_uuid,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );

        const gatewayStatus = verifyResp.data?.status;
        const gatewayAmount = Number(verifyResp.data?.total_amount);

        if (gatewayStatus !== 'COMPLETE') {
          payment.status = 'failed';
          await payment.save();
          return res.status(400).json({
            success: false,
            message: `Payment not completed on gateway (status: ${gatewayStatus})`,
          });
        }

        if (
          Number.isFinite(gatewayAmount) &&
          gatewayAmount > 0 &&
          gatewayAmount !== decodedAmount
        ) {
          payment.status = 'failed';
          await payment.save();
          return res.status(400).json({
            success: false,
            message: 'Payment amount mismatch between eSewa verification and callback payload',
          });
        }
      } catch (err) {
        console.error('eSewa verification error:', err.message);
        return res.status(502).json({
          success: false,
          message: 'Failed to verify payment with eSewa gateway',
        });
      }
    }

    await markPaymentCompleted({ paymentId: payment._id });
    return res.json({ success: true, message: 'Payment completed' });
  }

  payment.status = 'failed';
  await payment.save();
  return res.status(400).json({
    success: false,
    message: `Payment not completed (status: ${status})`,
  });
});

/**
 * POST /api/v1/payments/initiate-payment
 * Unified Khalti initiate. Body: { type: 'order', orderId } | { type: 'service', serviceRequestId, amount }
 * Returns paymentUrl and pidx for User App/Web to open/redirect.
 */
const initiatePayment = asyncHandler(async (req, res) => {
  if (!req.user?._id) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!isKhaltiConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Khalti is not configured. Set KHALTI_SECRET_KEY and KHALTI_BASE_URL.',
    });
  }

  const { type, orderId, serviceRequestId, amount, careBookingId } = req.body || {};
  const userId = req.user._id.toString();

  if (type === 'order' && orderId) {
    const order = await Order.findById(orderId).populate('user', 'name email phone').lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not your order' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }
    const amountNpr = Number(order.totalAmount) || 0;
    if (amountNpr < 0.1) {
      return res.status(400).json({ success: false, message: 'Invalid order amount' });
    }
    const amountPaisa = nprToPaisa(amountNpr);
    if (amountPaisa < 1000) {
      return res.status(400).json({
        success: false,
        message: 'Amount should be greater than Rs. 10 (1000 paisa)',
      });
    }
    const baseUrl = process.env.BASE_URL || process.env.KHALTI_RETURN_BASE || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/api/v1/payments/khalti/callback`;
    const payload = {
      return_url: returnUrl,
      website_url: baseUrl,
      amount: amountPaisa,
      purchase_order_id: orderId.toString(),
      purchase_order_name: `PawSewa Order #${String(orderId).slice(-6)}`,
      customer_info: {
        name: order.user.name || 'Customer',
        email: order.user.email || '',
        phone: order.user.phone || '',
      },
    };
    const resp = await axios.post(
      `${KHALTI_BASE_URL}/epayment/initiate/`,
      payload,
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const { pidx, payment_url } = resp.data || {};
    if (!pidx || !payment_url) {
      return res.status(502).json({ success: false, message: 'Khalti did not return pidx or payment_url' });
    }
    return res.json({
      success: true,
      data: {
        pidx,
        paymentUrl: payment_url,
        successUrl: `${baseUrl}/api/v1/payments/payment-success`,
        orderId: orderId.toString(),
        amount: amountNpr,
      },
    });
  }

  if (type === 'care_booking' && careBookingId) {
    try {
      const result = await initiateCareBookingKhalti({
        userId: req.user._id,
        careBookingId,
      });
      return res.json({
        success: true,
        data: {
          paymentId: result.paymentId,
          pidx: result.pidx,
          paymentUrl: result.paymentUrl,
          successUrl: result.successUrl,
          careBookingId: result.careBookingId,
          amount: result.amount,
        },
      });
    } catch (err) {
      const code = err.statusCode || 500;
      return res.status(code).json({ success: false, message: err.message || 'Payment initiation failed' });
    }
  }

  if (type === 'service' && serviceRequestId && typeof amount === 'number' && amount > 0) {
    const serviceRequest = await ServiceRequest.findById(serviceRequestId).select('user status');
    if (!serviceRequest) {
      return res.status(404).json({ success: false, message: 'Service request not found' });
    }
    if (serviceRequest.user.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not allowed for this request' });
    }
    const amountPaisa = nprToPaisa(amount);
    const payment = await Payment.create({
      user: req.user._id,
      serviceRequest: serviceRequestId,
      targetType: 'service',
      amount,
      currency: 'NPR',
      gateway: 'khalti',
      status: 'pending',
    });
    const baseUrl = process.env.BASE_URL || process.env.KHALTI_RETURN_BASE || 'http://localhost:3000';
    const returnUrl = `${baseUrl}/api/v1/payments/khalti/callback`;
    const payload = {
      return_url: returnUrl,
      website_url: baseUrl,
      amount: amountPaisa,
      purchase_order_id: payment._id.toString(),
      purchase_order_name: `Service Request ${serviceRequestId}`,
    };
    const resp = await axios.post(
      `${KHALTI_BASE_URL}/epayment/initiate/`,
      payload,
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const { pidx, payment_url } = resp.data || {};
    payment.gatewayTransactionId = pidx;
    payment.rawGatewayPayload = resp.data || {};
    await payment.save();
    return res.json({
      success: true,
      data: {
        paymentId: payment._id,
        pidx,
        paymentUrl: payment_url,
        successUrl: `${baseUrl}/api/v1/payments/payment-success`,
      },
    });
  }

  return res.status(400).json({
    success: false,
    message: 'Invalid body. Use { type: "order", orderId } or { type: "care_booking", careBookingId } or { type: "service", serviceRequestId, amount }',
  });
});

/**
 * POST /api/v1/payments/verify-payment
 * Verify Khalti transaction using pidx. Calls Khalti /epayment/lookup/.
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { pidx } = req.body || {};
  if (!pidx) {
    return res.status(400).json({ success: false, message: 'pidx is required' });
  }

  if (!isKhaltiConfigured()) {
    return res.status(503).json({ success: false, message: 'Khalti is not configured' });
  }

  const lookupResp = await axios.post(
    `${KHALTI_BASE_URL}/epayment/lookup/`,
    { pidx },
    {
      headers: {
        Authorization: `Key ${KHALTI_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const status = lookupResp.data?.status;
  const purchaseOrderId = lookupResp.data?.purchase_order_id;

  if (status === 'Completed' && purchaseOrderId) {
    const order = await Order.findById(purchaseOrderId);
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      order.paymentMethod = 'khalti';
      await order.save();
      return res.json({ success: true, message: 'Payment completed', orderId: order._id });
    }
    const payment = await Payment.findById(purchaseOrderId);
    if (payment && payment.status !== 'completed') {
      await markPaymentCompleted({ paymentId: payment._id });
      return res.json({ success: true, message: 'Payment completed', paymentId: payment._id });
    }
    return res.json({ success: true, message: 'Payment already recorded' });
  }

  return res.status(400).json({
    success: false,
    message: status ? `Payment not completed (status: ${status})` : 'Payment verification failed',
  });
});

module.exports = {
  initiateKhalti,
  verifyKhalti,
  initiatePayment,
  initiateCareBookingKhalti,
  initiateSubscriptionKhalti,
  verifyPayment,
  khaltiCallback,
  paymentSuccessPage,
  paymentFailedPage,
  initiateEsewa,
  verifyEsewa,
};

