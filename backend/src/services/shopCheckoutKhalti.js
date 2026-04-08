/**
 * Deferred shop checkout: Payment (targetType shop_order) holds a cart draft until
 * Khalti verification succeeds, then creates the Order atomically.
 */
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');
const { broadcastShopOrder } = require('./orderSocketNotify');
const { sendMulticastToUser } = require('../utils/fcm');
const Notification = require('../models/Notification');

function normalizeDraftLiveLocation(ll) {
  if (!ll || typeof ll !== 'object') return null;
  const lat = Number(ll.lat);
  const lng = Number(ll.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const ts = ll.timestamp != null ? new Date(ll.timestamp) : new Date();
  return {
    lat,
    lng,
    timestamp: Number.isNaN(ts.getTime()) ? new Date() : ts,
  };
}

/**
 * @param {import('mongoose').Document} payment - Payment doc (shop_order, pending)
 * @param {string|null|undefined} khaltiTransactionId
 * @param {object} [lookupData] - Khalti lookup payload (stored on payment)
 */
async function finalizeShopCheckoutPayment(payment, khaltiTransactionId, lookupData = {}) {
  const pid = payment._id;

  if (payment.metadata?.orderId) {
    const existing = await Order.findById(payment.metadata.orderId);
    if (existing) {
      return existing;
    }
  }

  const draft = payment.metadata?.draft;
  if (!draft || !Array.isArray(draft.items) || draft.items.length === 0) {
    throw new Error('Invalid shop checkout draft');
  }

  const session = await mongoose.startSession();
  let createdOrder = null;

  try {
    await session.withTransaction(async () => {
      const p = await Payment.findById(pid).session(session);
      if (!p) {
        throw new Error('Payment not found');
      }
      if (p.metadata?.orderId) {
        const ord = await Order.findById(p.metadata.orderId).session(session);
        if (ord) {
          createdOrder = ord;
          return;
        }
      }
      if (p.status === 'completed' && p.metadata?.orderId) {
        createdOrder = await Order.findById(p.metadata.orderId).session(session);
        return;
      }

      const liveLoc = normalizeDraftLiveLocation(draft.liveLocation);
      const orderPayload = {
        user: p.user,
        customerId: draft.customerId || p.user,
        assignedSeller: draft.assignedSeller,
        shopId: draft.shopId || draft.assignedSeller,
        items: draft.items,
        totalAmount: draft.totalAmount ?? p.amount,
        deliveryLocation: draft.deliveryLocation,
        location: draft.location,
        deliveryNotes: draft.deliveryNotes,
        paymentStatus: 'paid',
        paymentMethod: 'khalti',
        khaltiTransactionId: khaltiTransactionId || undefined,
        status: 'pending_confirmation',
      };
      if (liveLoc) {
        orderPayload.liveLocation = liveLoc;
      }

      const orderDocs = await Order.create([orderPayload], { session });

      createdOrder = orderDocs[0];
      p.status = 'completed';
      p.gatewayTransactionId = khaltiTransactionId || p.gatewayTransactionId;
      p.rawGatewayPayload = { ...(p.rawGatewayPayload || {}), ...lookupData };
      p.metadata = {
        ...(p.metadata || {}),
        orderId: String(createdOrder._id),
      };
      await p.save({ session });
    });
  } finally {
    session.endSession();
  }

  if (!createdOrder) {
    createdOrder = await Order.findById(payment.metadata?.orderId);
  }
  if (!createdOrder) {
    throw new Error('Order creation failed');
  }

  const oid = createdOrder._id;

  try {
    await broadcastShopOrder(oid, 'new_order');
    await broadcastShopOrder(oid, 'assign_seller');
    await broadcastShopOrder(oid, 'paid');
  } catch (e) {
    logger.warn('broadcastShopOrder after Khalti finalize:', e?.message || String(e));
  }

  try {
    await sendMulticastToUser(payment.user, {
      title: 'Payment successful!',
      body: 'Your order is being processed.',
      data: {
        type: 'shop_order_paid',
        orderId: String(oid),
        event: 'khalti_paid',
      },
    });
  } catch (e) {
    logger.warn('FCM customer payment success skipped:', e?.message || String(e));
  }

  const sellerId = createdOrder.assignedSeller || createdOrder.shopId;
  if (sellerId) {
    try {
      await sendMulticastToUser(sellerId, {
        title: 'New shop order',
        body: `Order #${String(oid).slice(-6)} — paid via Khalti.`,
        data: {
          type: 'shop_order',
          orderId: String(oid),
          event: 'new_order',
        },
      });
    } catch (e) {
      logger.warn('FCM seller new order skipped:', e?.message || String(e));
    }
  }

  try {
    await Notification.create({
      user: payment.user,
      title: 'Order received',
      message: `Payment received. Your order #${String(oid).slice(-6)} is being processed.`,
      type: 'system',
      isRead: false,
    });
  } catch (e) {
    logger.warn('Order in-app notification skipped:', e?.message || String(e));
  }

  logger.success(
    `Shop checkout finalized: payment=${pid} order=${oid} txn=${khaltiTransactionId || 'n/a'}`
  );

  return createdOrder;
}

module.exports = { finalizeShopCheckoutPayment };
