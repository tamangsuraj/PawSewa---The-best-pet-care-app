const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

const Payment = require('../models/Payment');
const ServiceRequest = require('../models/ServiceRequest');
const CareRequest = require('../models/CareRequest');
const Order = require('../models/Order');

const KHALTI_BASE_URL = process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2';
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || '';

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
  try {
    const lookupResp = await axios.post(
      `${KHALTI_BASE_URL.replace(/\/$/, '')}/epayment/lookup/`,
      { pidx },
      {
        headers: {
          Authorization: `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    lookupStatus = lookupResp.data?.status;
  } catch (err) {
    console.error('[Khalti callback] Lookup failed:', err?.response?.data || err.message);
  }

  const base = process.env.BASE_URL || process.env.KHALTI_RETURN_BASE || 'http://localhost:3000';
  const successRedirect =
    process.env.KHALTI_SUCCESS_REDIRECT || `${base}/api/v1/payments/payment-success`;
  const failRedirect =
    process.env.KHALTI_FAIL_REDIRECT || `${base}/api/v1/payments/payment-failed`;

  if (lookupStatus === 'Completed' && purchaseOrderId) {
    const order = await Order.findById(purchaseOrderId);
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      await order.save();
    }
  }

  if (lookupStatus === 'Completed') {
    const orderId = purchaseOrderId || '';
    return res.redirect(`${successRedirect}?orderId=${orderId}`);
  }

  return res.redirect(`${failRedirect}?reason=${encodeURIComponent(lookupStatus || 'unknown')}`);
});

/**
 * GET /payment-success - Simple HTML page after successful Khalti payment (for redirect target).
 */
const paymentSuccessPage = (req, res) => {
  const orderId = req.query?.orderId || '';
  res.set('Content-Type', 'text/html');
  res.send(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Successful</title></head><body style="font-family:sans-serif;max-width:360px;margin:60px auto;padding:24px;text-align:center;"><h2 style="color:#22c55e;">Payment Successful</h2><p>Thank you for your order. You can close this page and return to the PawSewa app.</p>${orderId ? `<p><small>Order ID: ${orderId}</small></p>` : ''}</body></html>`
  );
};

/**
 * GET /payment-failed - Simple HTML page after failed/cancelled payment.
 */
const paymentFailedPage = (req, res) => {
  const reason = req.query?.reason || 'Payment was not completed.';
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

module.exports = {
  initiateKhalti,
  verifyKhalti,
  khaltiCallback,
  paymentSuccessPage,
  paymentFailedPage,
  initiateEsewa,
  verifyEsewa,
};

