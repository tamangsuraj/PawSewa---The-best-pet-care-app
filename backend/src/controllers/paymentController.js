const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const CareRequest = require('../models/CareRequest');

const KHALTI_BASE_URL = process.env.KHALTI_BASE_URL || 'https://a.khalti.com/api/v2';
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || '';

const ESEWA_INIT_URL = process.env.ESEWA_INIT_URL || '';
const ESEWA_VERIFY_SECRET = process.env.ESEWA_SECRET_KEY || '';
const ESEWA_PRODUCT_CODE = process.env.ESEWA_PRODUCT_CODE || '';

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
      }
    });
  } finally {
    session.endSession();
  }
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

  // Amount in paisa as per Khalti spec
  const amountPaisa = Math.round(amount * 100);

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

  if (status === 'COMPLETE') {
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

module.exports = {
  initiateKhalti,
  verifyKhalti,
  initiateEsewa,
  verifyEsewa,
};

