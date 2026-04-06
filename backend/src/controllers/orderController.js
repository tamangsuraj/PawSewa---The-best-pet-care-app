const asyncHandler = require('express-async-handler');
const axios = require('axios');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../utils/logger');
const Notification = require('../models/Notification');
const { broadcastShopOrder } = require('../services/orderSocketNotify');
const {
  ensureDeliveryConversationForOrder,
  setDeliveryConversationExpiry,
} = require('../services/marketplaceChatService');
const {
  KHALTI_BASE_URL,
  KHALTI_SECRET_KEY,
  KHALTI_PUBLIC_KEY,
  nprToPaisa,
  isKhaltiConfigured,
} = require('../config/payment_config');

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

  const notes = typeof deliveryNotes === 'string' ? deliveryNotes.trim().slice(0, 500) : null;

  // Load products and compute total
  const productIds = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, isAvailable: true }).lean();

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

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
    };
  });

  const payMethod = typeof paymentMethod === 'string' && paymentMethod.trim() ? paymentMethod.trim().toLowerCase() : null;
  const isCodOrFonepay = payMethod && ['cod', 'cash_on_delivery', 'fonepay', 'cash on delivery'].includes(payMethod);

  const order = await Order.create({
    user: userId,
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
    status: 'pending',
    paymentStatus: isCodOrFonepay ? 'unpaid' : 'unpaid',
  });

  logger.info(`Order ${order._id}: GPS Coordinates captured (Lat: ${lat}, Lng: ${lng}).`);
  logger.success('[SUCCESS] GPS Order Logged', String(order._id), `lat=${lat}`, `lng=${lng}`);
  logger.info('New Order Received: ID', order._id.toString());

  await broadcastShopOrder(order._id, 'new_order');

  try {
    await Notification.create({
      user: userId,
      title: 'Order received',
      message: `We received your order with ${orderItems.length} item(s). Total NPR ${total}. Track it in My Orders.`,
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
    .sort({ createdAt: -1 });

  res.json({ success: true, data: orders });
});

// Admin: GET /api/v1/orders
// Query: status, liveOnly (1 = only pending|processing|out_for_delivery), limit (default 20), page (default 1)
const adminGetOrders = asyncHandler(async (req, res) => {
  const { status, liveOnly, limit: limitQ, page: pageQ } = req.query;
  const filter = {};
  if (liveOnly === '1' || liveOnly === 'true') {
    filter.status = { $in: ['pending', 'processing', 'out_for_delivery'] };
  }
  if (status) filter.status = status;

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
    .populate('assignedSeller', 'name email phone')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: orders });
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
    status: { $in: ['pending', 'processing', 'out_for_delivery'] },
  })
    .populate('user', 'name email phone')
    .populate('assignedSeller', 'name email phone')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: orders });
});

/**
 * Rider or Admin: PATCH /api/v1/orders/:orderId/status
 * Body: { status: 'pending' | 'processing' | 'out_for_delivery' | 'delivered' }
 * Rider can only update orders assigned to them.
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

  if (!status || !['pending', 'processing', 'out_for_delivery', 'delivered'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Valid status: pending, processing, out_for_delivery, delivered',
    });
  }

  const current = order.status;
  const validTransitions = {
    pending: ['processing'],
    processing: ['out_for_delivery'],
    out_for_delivery: ['delivered'],
    delivered: [],
  };
  const allowed = validTransitions[current];
  if (!Array.isArray(allowed) || !allowed.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot change status from "${current}" to "${status}". Allowed: ${(allowed || []).join(', ') || 'none'}.`,
    });
  }

  order.status = status;
  if (status === 'delivered') {
    order.deliveredAt = new Date();
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

  res.json({
    success: true,
    data: updated,
    message: 'Status updated',
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
  }

  if (status && ['pending', 'processing', 'out_for_delivery', 'delivered'].includes(status)) {
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

  order.sellerConfirmedAt = new Date();
  await order.save();

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone');

  await broadcastShopOrder(orderId, 'seller_confirmed');

  res.json({
    success: true,
    data: updated,
    message: 'Stock confirmed',
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

  const refreshed = await Order.find({ _id: { $in: orderIds } }).lean();
  for (const o of refreshed) {
    if (o.assignedRider) {
      await ensureDeliveryConversationForOrder(o);
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

  const baseUrl = process.env.BASE_URL || process.env.KHALTI_RETURN_BASE || 'http://localhost:3000';
  const returnUrl = `${baseUrl}/api/v1/payments/khalti/callback`;

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
  if (order.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Delivery GPS can only be updated while the order is pending',
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
  await order.save();

  logger.info(`Order ${order._id}: GPS Coordinates captured (Lat: ${latN}, Lng: ${lngN}).`);

  res.json({ success: true, data: order });
});

module.exports = {
  createOrder,
  getMyOrders,
  adminGetOrders,
  getRiderAssignedOrders,
  getSellerAssignedOrders,
  getRiderActiveOrders,
  updateOrderStatus,
  assignRiderToOrder,
  assignSellerToOrder,
  confirmSellerOrder,
  bulkAssignOrders,
  initiateKhaltiForOrder,
  updateMyOrderDeliveryGps,
};

