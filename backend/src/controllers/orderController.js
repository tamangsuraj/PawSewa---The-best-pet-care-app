const asyncHandler = require('express-async-handler');
const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');
const Notification = require('../models/Notification');
const { broadcastShopOrder } = require('../services/orderSocketNotify');
const {
  ensureDeliveryConversationForOrder,
  setDeliveryConversationExpiry,
  resolveProductSellerId,
} = require('../services/marketplaceChatService');
const { sendMulticastToUser, sendMulticastToAdmins } = require('../utils/fcm');
const {
  KHALTI_BASE_URL,
  KHALTI_SECRET_KEY,
  KHALTI_PUBLIC_KEY,
  nprToPaisa,
  isKhaltiConfigured,
  getKhaltiPublicBaseUrlFromRequest,
} = require('../config/payment_config');

/**
 * Expose customerPhone and pickupAddress for rider apps (maps + tel:).
 */
function shapeOrderForRiderClient(o) {
  if (!o || typeof o !== 'object') return o;
  const userPhone =
    o.user && typeof o.user === 'object' && o.user.phone != null
      ? String(o.user.phone).trim()
      : '';
  o.customerPhone = userPhone;
  const seller = o.assignedSeller;
  let pickupLine = 'PawSewa Shop';
  if (seller && typeof seller === 'object') {
    const cn = seller.clinicName != null ? String(seller.clinicName).trim() : '';
    const nm = seller.name != null ? String(seller.name).trim() : '';
    const ca = seller.clinicAddress != null ? String(seller.clinicAddress).trim() : '';
    const head = cn || nm || 'Shop';
    pickupLine = ca ? `${head} — ${ca}` : head;
  }
  if (!o.pickupAddress || typeof o.pickupAddress !== 'object') {
    o.pickupAddress = { address: pickupLine };
  } else if (!o.pickupAddress.address) {
    o.pickupAddress.address = pickupLine;
  }
  return o;
}

function parseOrderGps(body) {
  const raw = body || {};
  const loc = raw.location;
  const dl = raw.deliveryLocation || {};
  let lat;
  let lng;
  let address = '';

  if (loc && typeof loc === 'object') {
    lat = Number(loc.lat);
    lng = Number(loc.lng);
    if (typeof loc.address === 'string' && loc.address.trim()) {
      address = loc.address.trim();
    }
  }
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && dl.coordinates) {
    const c = dl.coordinates;
    if (Array.isArray(c) && c.length === 2) {
      lng = Number(c[0]);
      lat = Number(c[1]);
    }
  }
  if (!address && typeof dl.address === 'string' && dl.address.trim()) {
    address = dl.address.trim();
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'Invalid GPS coordinates' };
  }
  return { lat, lng, address, coordinates: [lng, lat] };
}

function parseOrderLiveLocation(body) {
  const ll = body?.liveLocation;
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

// POST /api/v1/orders
// Body: { items, deliveryLocation: { address, coordinates: [lng, lat] }, location?: { lat, lng, address } }
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const { items, deliveryLocation, deliveryNotes, paymentMethod, location } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order items are required' });
  }

  const parsed = parseOrderGps({ location, deliveryLocation });
  if (parsed?.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }
  if (!parsed) {
    return res.status(400).json({
      success: false,
      message:
        'Delivery location must include address and valid latitude/longitude (high-accuracy GPS required).',
    });
  }
  const { address, coordinates, lat, lng } = parsed;
  const liveLoc = parseOrderLiveLocation(req.body);

  const notes = typeof deliveryNotes === 'string' ? deliveryNotes.trim().slice(0, 500) : null;

  // Load products and compute total
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, isAvailable: true }).lean();

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const sellerIds = new Set();
  for (const p of products) {
    const sid = await resolveProductSellerId(p);
    if (sid) sellerIds.add(String(sid));
  }
  if (sellerIds.size > 1) {
    return res.status(400).json({
      success: false,
      message: 'All items must be from the same shop. Split your order to checkout separately.',
    });
  }
  if (sellerIds.size === 0) {
    return res.status(400).json({
      success: false,
      message: 'Products have no assigned shop. Please try again later or contact support.',
    });
  }
  const primarySeller = [...sellerIds][0];

  for (const raw of items) {
    const pRow = productMap.get(raw.productId);
    if (!pRow) continue;
    const sid = raw?.sellerId;
    if (sid != null && String(sid).trim() !== '') {
      const resolved = await resolveProductSellerId(pRow);
      if (!resolved || String(resolved) !== String(sid)) {
        return res.status(400).json({
          success: false,
          message: 'Cart seller information does not match the product shop. Refresh and try again.',
        });
      }
    }
  }

  let total = 0;
  const orderItems = items.map((i) => {
    const p = productMap.get(i.productId);
    if (!p) {
      throw new Error('One or more products are unavailable');
    }
    const quantity = Number(i.quantity) || 1;
    const lineTotal = p.price * quantity;
    total += lineTotal;
    return {
      product: p._id,
      name: p.name,
      price: p.price,
      quantity,
      sellerId: primarySeller,
    };
  });

  const payMethod = typeof paymentMethod === 'string' && paymentMethod.trim() ? paymentMethod.trim().toLowerCase() : null;
  const isCodOrFonepay = payMethod && ['cod', 'cash_on_delivery', 'fonepay', 'cash on delivery'].includes(payMethod);
  const isKhaltiDeferred = payMethod === 'khalti' || payMethod === 'khalti_epay';

  /** Khalti: hold a Payment + draft only; Order is created after gateway verification (atomic). */
  if (isKhaltiDeferred) {
    const draft = {
      customerId: userId,
      assignedSeller: primarySeller,
      shopId: primarySeller,
      sellerId: primarySeller,
      items: orderItems,
      totalAmount: total,
      deliveryLocation: {
        address,
        point: {
          type: 'Point',
          coordinates,
        },
      },
      location: {
        lat,
        lng,
        address,
      },
      deliveryNotes: notes || undefined,
    };
    if (liveLoc) {
      draft.liveLocation = {
        lat: liveLoc.lat,
        lng: liveLoc.lng,
        timestamp: liveLoc.timestamp,
      };
    }
    const checkoutPayment = await Payment.create({
      user: userId,
      targetType: 'shop_order',
      amount: total,
      currency: 'NPR',
      gateway: 'khalti',
      status: 'pending',
      metadata: {
        draft,
      },
    });
    logger.info(`Shop Khalti checkout created: payment=${checkoutPayment._id} (order deferred)`);
    return res.status(201).json({
      success: true,
      data: {
        checkoutPaymentId: checkoutPayment._id,
        amount: total,
        deferred: true,
      },
    });
  }

  const orderPayload = {
    user: userId,
    customerId: userId,
    assignedSeller: primarySeller,
    shopId: primarySeller,
    sellerId: primarySeller,
    items: orderItems,
    totalAmount: total,
    deliveryLocation: {
      address,
      point: {
        type: 'Point',
        coordinates,
      },
    },
    location: {
      lat,
      lng,
      address,
    },
    deliveryNotes: notes || undefined,
    paymentMethod: isCodOrFonepay ? (payMethod === 'fonepay' ? 'fonepay' : 'cod') : undefined,
    status: 'pending_confirmation',
    paymentStatus: isCodOrFonepay ? 'unpaid' : 'unpaid',
  };
  if (liveLoc) {
    orderPayload.liveLocation = liveLoc;
  }
  const order = await Order.create(orderPayload);

  logger.info(`Order ${order._id}: GPS Coordinates captured (Lat: ${lat}, Lng: ${lng}).`);
  logger.info('New Order Received: ID', order._id.toString());
  logger.info(`Order ${order._id}: Automated seller identification successful.`);
  logger.info(`Routing real-time ping to Seller ID: ${primarySeller}`);

  await broadcastShopOrder(order._id, 'new_order');
  await broadcastShopOrder(order._id, 'assign_seller');

  try {
    await sendMulticastToUser(primarySeller, {
      title: 'New shop order',
      body: `Order #${String(order._id).slice(-6)} — confirm stock when ready.`,
      data: {
        type: 'shop_order',
        orderId: String(order._id),
        event: 'new_order',
      },
    });
  } catch (e) {
    logger.warn('FCM seller new order skipped:', e?.message || String(e));
  }

  try {
    await Notification.create({
      user: userId,
      title: 'Order received',
      message: `We received your pet supplies order (${orderItems.length} item(s)). Total NPR ${total}. Track order progress in My Orders.`,
      type: 'system',
      isRead: false,
    });
  } catch (e) {
    logger.warn('Order in-app notification skipped:', e?.message || String(e));
  }

  res.status(201).json({ success: true, data: order });
});

// GET /api/v1/orders/my
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('items.product', 'name images')
    .populate('assignedRider', 'name phone profilePicture')
    .populate('assignedSeller', 'name phone')
    .populate('shopId', 'name phone')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: orders });
});

const TERMINAL_ORDER_STATUSES = ['delivered', 'returned', 'refunded', 'cancelled'];

// GET /api/v1/orders/user/:userId?scope=all|current|past
// Caller must be the same user or admin. Used for explicit history fetches and tooling.
const getOrdersForUser = asyncHandler(async (req, res) => {
  const targetId = req.params.userId;
  const uid = req.user?._id?.toString();
  const role = (req.user?.role || '').toString().toLowerCase();
  const isAdmin = role === 'admin';
  if (!uid) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!isAdmin && uid !== String(targetId)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  logger.info('Fetching Order History for UID:', String(targetId));

  const scope = String(req.query.scope || 'all').toLowerCase();
  const filter = { user: targetId };
  if (scope === 'current') {
    filter.status = { $nin: TERMINAL_ORDER_STATUSES };
  } else if (scope === 'past') {
    filter.status = { $in: TERMINAL_ORDER_STATUSES };
  }

  const orders = await Order.find(filter)
    .populate('items.product', 'name images')
    .populate('assignedRider', 'name phone profilePicture')
    .populate('assignedSeller', 'name phone')
    .populate('shopId', 'name phone')
    .sort({ createdAt: -1 });

  logger.success(`${orders.length} history records retrieved successfully.`);

  res.json({ success: true, data: orders });
});

// Admin: GET /api/v1/orders
// Query: status, liveOnly (1 = only pending|processing|out_for_delivery), limit (default 20), page (default 1)
const adminGetOrders = asyncHandler(async (req, res) => {
  const {
    status,
    liveOnly,
    terminalOnly,
    limit: limitQ,
    page: pageQ,
    assignedSeller,
    assignedRider,
    createdAfter,
    createdBefore,
  } = req.query;
  const filter = {};
  if (terminalOnly === '1' || terminalOnly === 'true') {
    filter.status = { $in: TERMINAL_ORDER_STATUSES };
  } else if (liveOnly === '1' || liveOnly === 'true') {
    filter.status = {
      $in: [
        'pending_confirmation',
        'pending',
        'processing',
        'ready_for_pickup',
        'packed',
        'assigned_to_rider',
        'out_for_delivery',
      ],
    };
  }
  if (status) filter.status = status;
  if (assignedSeller && mongoose.Types.ObjectId.isValid(String(assignedSeller))) {
    filter.assignedSeller = assignedSeller;
  }
  if (assignedRider && mongoose.Types.ObjectId.isValid(String(assignedRider))) {
    filter.assignedRider = assignedRider;
  }
  if (createdAfter || createdBefore) {
    filter.createdAt = {};
    if (createdAfter) {
      const d = new Date(String(createdAfter));
      if (!Number.isNaN(d.getTime())) filter.createdAt.$gte = d;
    }
    if (createdBefore) {
      const d = new Date(String(createdBefore));
      if (!Number.isNaN(d.getTime())) filter.createdAt.$lte = d;
    }
  }

  const limit = Math.min(Math.max(Number(limitQ) || 20, 1), 100);
  const page = Math.max(Number(pageQ) || 1, 1);
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email phone')
      .populate('assignedRider', 'name email phone')
      .populate('assignedSeller', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

/**
 * Rider: GET /api/v1/orders/rider/assigned
 * Returns orders assigned to the current rider (any status, for list + history).
 */
const getRiderAssignedOrders = asyncHandler(async (req, res) => {
  const riderId = req.user?._id;
  if (!riderId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const orders = await Order.find({ assignedRider: riderId })
    .populate('user', 'name email phone')
    .populate('assignedSeller', 'name email phone clinicName clinicAddress')
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 })
    .lean();

  const data = orders.map((doc) => shapeOrderForRiderClient({ ...doc }));

  res.json({ success: true, data });
});

/**
 * Rider: GET /api/v1/orders/rider/active
 * Returns orders assigned to the current rider that are still active (not delivered).
 */
/**
 * Shop owner: GET /api/v1/orders/seller/assigned
 * Product orders assigned to this seller for fulfillment.
 */
const getSellerAssignedOrders = asyncHandler(async (req, res) => {
  const sellerId = req.user?._id;
  if (!sellerId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const orders = await Order.find({ assignedSeller: sellerId })
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name phone')
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: orders });
});

const getRiderActiveOrders = asyncHandler(async (req, res) => {
  const riderId = req.user?._id;
  if (!riderId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const orders = await Order.find({
    assignedRider: riderId,
    status: {
      $in: [
        'pending',
        'pending_confirmation',
        'processing',
        'packed',
        'ready_for_pickup',
        'assigned_to_rider',
        'out_for_delivery',
      ],
    },
  })
    .populate('user', 'name email phone')
    .populate('assignedSeller', 'name email phone clinicName clinicAddress')
    .populate('items.product', 'name images')
    .sort({ createdAt: -1 })
    .lean();

  const data = orders.map((doc) => shapeOrderForRiderClient({ ...doc }));

  res.json({ success: true, data });
});

const ORDER_STATUS_VALUES = [
  'pending_confirmation',
  'pending',
  'processing',
  'ready_for_pickup',
  'packed',
  'assigned_to_rider',
  'out_for_delivery',
  'delivered',
  'returned',
  'refunded',
  'cancelled',
];

function allowedStatusTransitions(current, { isAdmin, isAssignedRider }) {
  const graph = {
    pending_confirmation: ['cancelled', 'pending', 'processing'],
    pending: ['processing', 'cancelled', 'pending_confirmation', 'ready_for_pickup'],
    processing: ['packed', 'ready_for_pickup', 'out_for_delivery', 'cancelled'],
    ready_for_pickup: ['assigned_to_rider', 'out_for_delivery', 'cancelled'],
    packed: ['assigned_to_rider', 'out_for_delivery', 'ready_for_pickup', 'cancelled'],
    assigned_to_rider: ['out_for_delivery', 'cancelled'],
    out_for_delivery: ['delivered'],
    delivered: ['returned', 'refunded'],
    returned: [],
    refunded: [],
    cancelled: [],
  };
  let allowed = graph[current] || [];
  if (isAssignedRider && !isAdmin) {
    const riderOnly = {
      assigned_to_rider: ['out_for_delivery'],
      packed: ['out_for_delivery'],
      processing: ['out_for_delivery'],
      ready_for_pickup: ['out_for_delivery'],
      out_for_delivery: ['delivered'],
    };
    allowed = riderOnly[current] || [];
  }
  return allowed;
}

/**
 * Rider or Admin: PATCH /api/v1/orders/:orderId/status
 * Body: { status } — flow statuses + admin-only terminal transitions from delivered.
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body || {};

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const isAdmin = req.user?.role === 'admin';
  const isAssignedRider =
    order.assignedRider && order.assignedRider.toString() === req.user?._id?.toString();

  if (!isAdmin && !isAssignedRider) {
    return res.status(403).json({
      success: false,
      message: 'Only the assigned rider or admin can update this order status',
    });
  }

  if (!status || !ORDER_STATUS_VALUES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Valid status: ${ORDER_STATUS_VALUES.join(', ')}`,
    });
  }

  const current = order.status;
  const allowed = allowedStatusTransitions(current, { isAdmin, isAssignedRider });
  if (!allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot change status from "${current}" to "${status}". Allowed: ${allowed.join(', ') || 'none'}.`,
    });
  }

  if (status === 'cancelled' && !isAdmin) {
    return res.status(403).json({ success: false, message: 'Only admin can cancel an order' });
  }
  if ((status === 'returned' || status === 'refunded') && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Use the seller close endpoint for returns/refunds after delivery',
    });
  }

  order.status = status;
  if (status === 'delivered') {
    order.deliveredAt = new Date();
  }
  if (status === 'cancelled' && !order.fulfillmentCloseReason) {
    order.fulfillmentCloseReason = 'cancelled_by_admin';
  }
  await order.save();

  if (status === 'delivered') {
    await setDeliveryConversationExpiry(order._id);
  }

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  logger.info('Order Status Updated: ID', order._id.toString(), 'status', current, '->', status);
  await broadcastShopOrder(orderId, 'update');

  if (status === 'out_for_delivery' && order.user) {
    const customerId = order.user._id || order.user;
    try {
      await sendMulticastToUser(customerId, {
        title: 'Order progress',
        body: "Your pet's order is on the way!",
        data: {
          type: 'shop_order',
          orderId: String(orderId),
          event: 'out_for_delivery',
        },
      });
    } catch (e) {
      logger.warn('FCM customer out_for_delivery skipped:', e?.message || String(e));
    }
    try {
      await Notification.create({
        user: customerId,
        title: 'Order progress',
        message: "Your pet's order is on the way. Track order progress in My Orders.",
        type: 'system',
        isRead: false,
      });
    } catch (e) {
      logger.warn('In-app out_for_delivery notification skipped:', e?.message || String(e));
    }
  }

  res.json({
    success: true,
    data: updated,
    message: 'Status updated',
  });
});

/**
 * Rider: PATCH /api/v1/orders/:orderId/deliver
 * Body: { otp?: string, photoUrl?: string, notes?: string }
 * Sets proofOfDelivery and marks order delivered.
 */
const deliverOrderWithProof = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { otp, photoUrl, notes } = req.body || {};

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const uid = req.user?._id?.toString();
  const isAdmin = req.user?.role === 'admin';
  const isAssignedRider =
    order.assignedRider && order.assignedRider.toString() === uid;

  if (!isAdmin && !isAssignedRider) {
    return res.status(403).json({
      success: false,
      message: 'Only the assigned rider or admin can deliver this order',
    });
  }

  const otpStr = otp != null ? String(otp).trim() : '';
  const photoStr = photoUrl != null ? String(photoUrl).trim() : '';
  const notesStr = notes != null ? String(notes).trim() : '';

  if (!otpStr && !photoStr) {
    return res.status(400).json({
      success: false,
      message: 'Provide at least OTP or a delivery photo as proof',
    });
  }

  order.proofOfDelivery = {
    otp: otpStr,
    photoUrl: photoStr,
    notes: notesStr,
    submittedAt: new Date(),
    submittedBy: req.user?._id || null,
  };

  const current = order.status;
  // Allow delivering from out_for_delivery only (or admin override).
  if (!isAdmin && current !== 'out_for_delivery') {
    return res.status(400).json({
      success: false,
      message: 'Order must be out_for_delivery before it can be delivered',
    });
  }

  order.status = 'delivered';
  order.deliveredAt = new Date();
  await order.save();

  await setDeliveryConversationExpiry(order._id);
  await broadcastShopOrder(orderId, 'update');

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  res.json({
    success: true,
    data: updated,
    message: 'Delivered with proof',
  });
});

/**
 * Admin: PATCH /api/v1/orders/:orderId/assign
 * Body: { riderId: string, status?: 'pending' | 'processing' | 'out_for_delivery' | 'delivered' }
 */
const assignRiderToOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { riderId, status } = req.body || {};

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  if (riderId) {
    const rider = await User.findById(riderId).select('role');
    if (!rider || rider.role !== 'rider') {
      return res.status(400).json({ success: false, message: 'Invalid rider' });
    }
    order.assignedRider = riderId;
    if (
      ['ready_for_pickup', 'packed', 'processing', 'pending_confirmation', 'pending'].includes(
        order.status
      )
    ) {
      order.status = 'assigned_to_rider';
    }
  }

  if (status && ORDER_STATUS_VALUES.includes(status)) {
    order.status = status;
  }

  await order.save();
  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  if (order.assignedRider) {
    logger.info('Order Assigned To Rider: Order', order._id.toString(), 'Rider', order.assignedRider.toString());
    const plain = await Order.findById(orderId).lean();
    if (plain) await ensureDeliveryConversationForOrder(plain);
    await broadcastShopOrder(orderId, 'assign_rider');
    try {
      await sendMulticastToUser(order.assignedRider, {
        title: 'New task available',
        body: `Pick up order #${String(orderId).slice(-6)} for delivery.`,
        data: {
          type: 'rider_task',
          orderId: String(orderId),
          event: 'assigned',
        },
      });
    } catch (e) {
      logger.warn('FCM rider assign skipped:', e?.message || String(e));
    }
  } else {
    await broadcastShopOrder(orderId, 'update');
  }

  res.json({
    success: true,
    data: updated,
    message: order.assignedRider ? 'Rider assigned' : 'Order updated',
  });
});

/**
 * Admin: PATCH /api/v1/orders/:orderId/assign-seller
 * Body: { sellerId: string }
 */
const assignSellerToOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { sellerId } = req.body || {};

  if (!sellerId) {
    return res.status(400).json({ success: false, message: 'sellerId is required' });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const seller = await User.findById(sellerId).select('role');
  if (!seller || seller.role !== 'shop_owner') {
    return res.status(400).json({ success: false, message: 'Invalid seller (must be shop_owner)' });
  }

  order.assignedSeller = sellerId;
  order.shopId = sellerId;
  order.sellerId = sellerId;
  await order.save();

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  await broadcastShopOrder(orderId, 'assign_seller');

  res.json({
    success: true,
    data: updated,
    message: 'Seller assigned',
  });
});

/**
 * Shop owner: PATCH /api/v1/orders/:orderId/seller-confirm
 * Marks stock confirmed for orders assigned to this seller.
 */
const confirmSellerOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const uid = req.user?._id?.toString();
  if (!order.assignedSeller || order.assignedSeller.toString() !== uid) {
    return res.status(403).json({
      success: false,
      message: 'This order is not assigned to your shop',
    });
  }

  if (!['pending', 'pending_confirmation'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: 'Order is not awaiting shop confirmation',
    });
  }

  order.sellerConfirmedAt = new Date();
  order.status = 'ready_for_pickup';
  await order.save();

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  await broadcastShopOrder(orderId, 'seller_confirmed');

  try {
    await sendMulticastToAdmins({
      title: 'Order ready for rider',
      body: `Shop order #${String(orderId).slice(-6)} is ready — assign a rider.`,
      data: {
        type: 'shop_order_admin',
        orderId: String(orderId),
        event: 'ready_for_pickup',
      },
    });
  } catch (e) {
    logger.warn('FCM admin ready_for_pickup skipped:', e?.message || String(e));
  }

  res.json({
    success: true,
    data: updated,
    message: 'Stock confirmed — ready for rider assignment',
  });
});

/**
 * Admin: POST /api/v1/orders/bulk-assign
 * Body: { orderIds: string[], riderId: string }
 */
const bulkAssignOrders = asyncHandler(async (req, res) => {
  const { orderIds, riderId } = req.body || {};
  if (!Array.isArray(orderIds) || orderIds.length === 0 || !riderId) {
    return res.status(400).json({
      success: false,
      message: 'orderIds (array) and riderId are required',
    });
  }

  const rider = await User.findById(riderId).select('role');
  if (!rider || rider.role !== 'rider') {
    return res.status(400).json({ success: false, message: 'Invalid rider' });
  }

  const result = await Order.updateMany(
    { _id: { $in: orderIds } },
    { $set: { assignedRider: riderId } }
  );

  const refreshed = await Order.find({ _id: { $in: orderIds } });
  for (const o of refreshed) {
    if (
      o.assignedRider &&
      ['ready_for_pickup', 'packed', 'processing', 'pending_confirmation', 'pending'].includes(o.status)
    ) {
      o.status = 'assigned_to_rider';
      await o.save();
    }
    const lean = o.toObject ? o.toObject() : o;
    if (lean.assignedRider) {
      await ensureDeliveryConversationForOrder(lean);
    }
    try {
      await sendMulticastToUser(riderId, {
        title: 'New task available',
        body: `Pick up order #${String(o._id).slice(-6)}.`,
        data: { type: 'rider_task', orderId: String(o._id), event: 'assigned' },
      });
    } catch (e) {
      logger.warn('FCM bulk rider skipped:', e?.message || String(e));
    }
  }

  for (const oid of orderIds) {
    await broadcastShopOrder(oid, 'assign_rider');
  }

  res.json({
    success: true,
    message: `Assigned rider to ${result.modifiedCount} order(s)`,
    modifiedCount: result.modifiedCount,
  });
});

/**
 * POST /api/v1/orders/:orderId/khalti/initiate
 * Initiate Khalti payment for an order. Returns pidx and payment_url for the app to open.
 */
const initiateKhaltiForOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!isKhaltiConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Khalti is not configured. Set KHALTI_SECRET_KEY and KHALTI_BASE_URL.',
    });
  }

  const orderId = req.params.orderId;
  const order = await Order.findById(orderId).populate('user', 'name email phone').lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (order.user._id.toString() !== userId.toString()) {
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

  const baseUrl = getKhaltiPublicBaseUrlFromRequest(req);
  const cbMode = String(req.body?.callbackMode || process.env.KHALTI_CALLBACK_REDIRECT || 'app')
    .toLowerCase()
    .trim();

  // Prefer the explicit env var so physical devices always reach a reachable host.
  const envReturnUrl = (process.env.KHALTI_RETURN_URL || '').trim();
  let returnUrl;
  if (envReturnUrl) {
    const ru = new URL(envReturnUrl);
    if (!ru.searchParams.get('cb')) ru.searchParams.set('cb', cbMode === 'web' ? 'web' : 'app');
    returnUrl = ru.toString();
  } else {
    const ru = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/payments/khalti/callback`);
    ru.searchParams.set('cb', cbMode === 'web' ? 'web' : 'app');
    returnUrl = ru.toString();
  }
  logger.info(`Khalti initiate for order ${orderId}. Return URL: ${returnUrl}`);

  const payload = {
    return_url: returnUrl,
    website_url: baseUrl,
    amount: amountPaisa,
    purchase_order_id: orderId,
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
    return res.status(502).json({
      success: false,
      message: 'Khalti did not return pidx or payment_url',
    });
  }

  const successUrl = `${baseUrl}/api/v1/payments/payment-success`;

  res.json({
    success: true,
    data: {
      pidx,
      paymentUrl: payment_url,
      successUrl,
      publicKey: KHALTI_PUBLIC_KEY || undefined,
      amount: amountNpr,
      orderId,
    },
  });
});

/**
 * POST /api/v1/orders/checkout/khalti/initiate
 * Body: { checkoutPaymentId } — deferred shop checkout (Payment targetType shop_order).
 */
const initiateKhaltiForShopCheckout = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (!isKhaltiConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Khalti is not configured. Set KHALTI_SECRET_KEY and KHALTI_BASE_URL.',
    });
  }

  const checkoutPaymentId = (req.body?.checkoutPaymentId || '').toString().trim();
  if (!checkoutPaymentId) {
    return res.status(400).json({ success: false, message: 'checkoutPaymentId is required' });
  }

  const payment = await Payment.findOne({
    _id: checkoutPaymentId,
    user: userId,
    targetType: 'shop_order',
    status: 'pending',
  }).populate('user', 'name email phone');

  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Checkout session not found or already used',
    });
  }

  const amountNpr = Number(payment.amount) || 0;
  if (amountNpr < 0.1) {
    return res.status(400).json({ success: false, message: 'Invalid checkout amount' });
  }
  const amountPaisa = nprToPaisa(amountNpr);
  if (amountPaisa < 1000) {
    return res.status(400).json({
      success: false,
      message: 'Amount should be greater than Rs. 10 (1000 paisa)',
    });
  }

  const u = payment.user;
  const baseUrl = getKhaltiPublicBaseUrlFromRequest(req);
  const cbMode = String(req.body?.callbackMode || process.env.KHALTI_CALLBACK_REDIRECT || 'app')
    .toLowerCase()
    .trim();

  // Prefer the explicit env var so physical devices always reach a reachable host.
  const envReturnUrl = (process.env.KHALTI_RETURN_URL || '').trim();
  let returnUrl;
  if (envReturnUrl) {
    const ru = new URL(envReturnUrl);
    if (!ru.searchParams.get('cb')) ru.searchParams.set('cb', cbMode === 'web' ? 'web' : 'app');
    returnUrl = ru.toString();
  } else {
    const ru = new URL(`${baseUrl.replace(/\/$/, '')}/api/v1/payments/khalti/callback`);
    ru.searchParams.set('cb', cbMode === 'web' ? 'web' : 'app');
    returnUrl = ru.toString();
  }
  logger.info(`Khalti deferred checkout initiate for payment ${String(payment._id).slice(-6)}. Return URL: ${returnUrl}`);

  const payload = {
    return_url: returnUrl,
    website_url: baseUrl,
    amount: amountPaisa,
    purchase_order_id: String(payment._id),
    purchase_order_name: `PawSewa Checkout #${String(payment._id).slice(-6)}`,
    customer_info: {
      name: (u && u.name) || 'Customer',
      email: (u && u.email) || '',
      phone: (u && u.phone) || '',
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
    return res.status(502).json({
      success: false,
      message: 'Khalti did not return pidx or payment_url',
    });
  }

  payment.gatewayTransactionId = pidx;
  payment.rawGatewayPayload = resp.data || {};
  await payment.save();

  const successUrl = `${baseUrl}/api/v1/payments/payment-success`;

  res.json({
    success: true,
    data: {
      pidx,
      paymentUrl: payment_url,
      successUrl,
      publicKey: KHALTI_PUBLIC_KEY || undefined,
      amount: amountNpr,
      checkoutPaymentId: String(payment._id),
    },
  });
});

/**
 * PATCH /api/v1/orders/:orderId/delivery-gps
 * Owner only: refresh drop pin while order is still pending (e.g. after Khalti WebView, before final confirm).
 */
const updateMyOrderDeliveryGps = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  const { orderId } = req.params;
  const { lat, lng } = req.body || {};
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
    return res.status(400).json({ success: false, message: 'Valid lat and lng are required' });
  }
  if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) {
    return res.status(400).json({ success: false, message: 'Invalid GPS coordinates' });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (order.user.toString() !== userId.toString()) {
    return res.status(403).json({ success: false, message: 'Not your order' });
  }
  if (!['pending', 'pending_confirmation'].includes(order.status)) {
    return res.status(400).json({
      success: false,
      message: 'Delivery GPS can only be updated before the shop confirms the order',
    });
  }

  const coordinates = [lngN, latN];
  order.deliveryLocation.point.coordinates = coordinates;
  order.markModified('deliveryLocation');
  order.location = {
    lat: latN,
    lng: lngN,
    address: order.deliveryLocation.address,
  };
  order.liveLocation = {
    lat: latN,
    lng: lngN,
    timestamp: new Date(),
  };
  await order.save();

  logger.info(`Order ${order._id}: GPS Coordinates captured (Lat: ${latN}, Lng: ${lngN}).`);

  res.json({ success: true, data: order });
});

/**
 * Shop owner: PATCH /api/v1/orders/:orderId/seller-pack
 * processing → packed (ready for rider pickup).
 */
const sellerMarkPacked = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const uid = req.user?._id?.toString();
  if (!order.assignedSeller || order.assignedSeller.toString() !== uid) {
    return res.status(403).json({ success: false, message: 'This order is not assigned to your shop' });
  }
  if (order.status === 'ready_for_pickup' || order.status === 'packed') {
    return res.status(400).json({
      success: false,
      message: 'Order is already ready for pickup',
    });
  }
  if (order.status !== 'processing') {
    return res.status(400).json({
      success: false,
      message: 'Use Confirm stock for new orders. Mark packed is only for legacy “processing” orders.',
    });
  }
  order.status = 'ready_for_pickup';
  order.packedAt = new Date();
  await order.save();

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  await broadcastShopOrder(orderId, 'update');
  res.json({ success: true, data: updated, message: 'Marked as packed' });
});

/**
 * Shop owner: PATCH /api/v1/orders/:orderId/seller-tracking
 * Body: { trackingNumber: string }
 */
const sellerSetTracking = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { trackingNumber } = req.body || {};
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const uid = req.user?._id?.toString();
  if (!order.assignedSeller || order.assignedSeller.toString() !== uid) {
    return res.status(403).json({ success: false, message: 'This order is not assigned to your shop' });
  }
  const tn = trackingNumber != null ? String(trackingNumber).trim().slice(0, 200) : '';
  order.trackingNumber = tn;
  await order.save();

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  await broadcastShopOrder(orderId, 'update');
  res.json({ success: true, data: updated, message: 'Tracking updated' });
});

/**
 * Shop owner or admin: PATCH /api/v1/orders/:orderId/seller-close
 * delivered → returned | refunded with reason (analytics).
 */
const sellerCloseOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, reason } = req.body || {};
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  const isAdmin = req.user?.role === 'admin';
  const uid = req.user?._id?.toString();
  const isSeller = order.assignedSeller && order.assignedSeller.toString() === uid;
  if (!isAdmin && !isSeller) {
    return res.status(403).json({ success: false, message: 'Not allowed' });
  }
  if (!['returned', 'refunded'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be returned or refunded' });
  }
  if (order.status !== 'delivered') {
    return res.status(400).json({ success: false, message: 'Only delivered orders can be closed as returned/refunded' });
  }
  const r = reason != null ? String(reason).trim().slice(0, 500) : '';
  if (!r) {
    return res.status(400).json({ success: false, message: 'reason is required' });
  }
  order.status = status;
  order.fulfillmentCloseReason = r;
  await order.save();

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  await broadcastShopOrder(orderId, 'update');
  res.json({ success: true, data: updated, message: 'Order updated' });
});

/**
 * GET /api/v1/orders/:orderId/invoice
 * Customer (owner), assigned seller, or admin — JSON invoice for print/share.
 */
const getOrderInvoice = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const order = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('items.product', 'name sku')
    .populate('assignedSeller', 'name phone email')
    .lean();

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const uid = req.user?._id?.toString();
  const isAdmin = req.user?.role === 'admin';
  const ownerId = order.user && (order.user._id || order.user);
  const sellerId = order.assignedSeller && (order.assignedSeller._id || order.assignedSeller);
  const ok =
    isAdmin ||
    (ownerId && ownerId.toString() === uid) ||
    (sellerId && sellerId.toString() === uid);
  if (!ok) {
    return res.status(403).json({ success: false, message: 'Not allowed to view this invoice' });
  }

  const lines = (order.items || []).map((it) => ({
    productId: it.product ? (it.product._id || it.product).toString() : null,
    name: it.name || (it.product && it.product.name) || 'Item',
    unitPrice: it.price,
    quantity: it.quantity,
    lineTotal: (Number(it.price) || 0) * (Number(it.quantity) || 0),
  }));

  res.json({
    success: true,
    data: {
      orderId: order._id.toString(),
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      customer: order.user,
      seller: order.assignedSeller || null,
      deliveryAddress: order.deliveryLocation?.address || order.location?.address || '',
      trackingNumber: order.trackingNumber || '',
      lines,
      totalAmount: order.totalAmount,
      currency: 'NPR',
    },
  });
});

/**
 * Shop owner: GET /api/v1/orders/seller/analytics
 */
const getSellerShopAnalytics = asyncHandler(async (req, res) => {
  const sellerId = req.user?._id;
  if (!sellerId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  const sid = new mongoose.Types.ObjectId(sellerId);

  const baseMatch = { assignedSeller: sid };

  const [revAgg, placedCount, deliveredCount, cancelledAgg, bestAgg] = await Promise.all([
    Order.aggregate([
      { $match: { ...baseMatch, status: 'delivered' } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Order.countDocuments(baseMatch),
    Order.countDocuments({ ...baseMatch, status: 'delivered' }),
    Order.aggregate([
      {
        $match: {
          ...baseMatch,
          status: { $in: ['cancelled', 'returned', 'refunded'] },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$fulfillmentCloseReason', 'unknown'] },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Order.aggregate([
      { $match: { ...baseMatch, status: 'delivered' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          units: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { units: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const revenue = revAgg[0]?.revenue || 0;
  const deliveredOrders = revAgg[0]?.count || 0;
  const conversionRate =
    placedCount > 0 ? Math.round((deliveredCount / placedCount) * 1000) / 10 : 0;

  const productIds = bestAgg.map((b) => b._id).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('name images')
    .lean();
  const nameById = new Map(products.map((p) => [p._id.toString(), p]));

  const bestSellers = bestAgg.map((b) => {
    const id = b._id ? b._id.toString() : '';
    const p = nameById.get(id);
    return {
      productId: id,
      name: p?.name || 'Product',
      image: p?.images?.[0] || null,
      unitsSold: b.units,
      revenue: Math.round(b.revenue * 100) / 100,
    };
  });

  res.json({
    success: true,
    data: {
      revenue: Math.round(revenue * 100) / 100,
      ordersAssigned: placedCount,
      ordersDelivered: deliveredCount,
      conversionRatePercent: conversionRate,
      cancelledOrClosedByReason: cancelledAgg.map((c) => ({
        reason: c._id,
        count: c.count,
      })),
      bestSellers,
    },
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrdersForUser,
  adminGetOrders,
  getRiderAssignedOrders,
  getSellerAssignedOrders,
  getRiderActiveOrders,
  updateOrderStatus,
  deliverOrderWithProof,
  assignRiderToOrder,
  assignSellerToOrder,
  confirmSellerOrder,
  sellerMarkPacked,
  sellerSetTracking,
  sellerCloseOrder,
  getOrderInvoice,
  getSellerShopAnalytics,
  bulkAssignOrders,
  initiateKhaltiForOrder,
  initiateKhaltiForShopCheckout,
  updateMyOrderDeliveryGps,
};

