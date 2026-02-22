const asyncHandler = require('express-async-handler');
const axios = require('axios');
const Order = require('../models/Order');
const { getIO } = require('../sockets/socketStore');
const Product = require('../models/Product');
const {
  KHALTI_BASE_URL,
  KHALTI_SECRET_KEY,
  KHALTI_PUBLIC_KEY,
  nprToPaisa,
  isKhaltiConfigured,
} = require('../config/payment_config');

// POST /api/v1/orders
// Body: { items: [{ productId, quantity }], deliveryLocation: { address, coordinates: [lng, lat] } }
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const { items, deliveryLocation, deliveryNotes, paymentMethod } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order items are required' });
  }
  const { address, coordinates } = deliveryLocation || {};
  if (!address || !coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Delivery location must include address and coordinates [lng, lat]',
    });
  }
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
    deliveryNotes: notes || undefined,
    paymentMethod: isCodOrFonepay ? (payMethod === 'fonepay' ? 'fonepay' : 'cod') : undefined,
    status: 'pending',
    paymentStatus: isCodOrFonepay ? 'unpaid' : 'unpaid',
  });

  res.status(201).json({ success: true, data: order });
});

// GET /api/v1/orders/my
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate('items.product', 'name images')
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
    .sort({ createdAt: -1 });

  res.json({ success: true, data: orders });
});

/**
 * Rider: GET /api/v1/orders/rider/active
 * Returns orders assigned to the current rider where status != 'delivered'.
 */
const getRiderActiveOrders = asyncHandler(async (req, res) => {
  const riderId = req.user?._id;
  if (!riderId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const orders = await Order.find({
    assignedRider: riderId,
    status: { $ne: 'delivered' },
  })
    .populate('user', 'name email phone')
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
  await order.save();

  const io = getIO();
  if (io) {
    const updatedOrder = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('assignedRider', 'name email phone')
      .lean();
    io.emit('orderUpdate', { order: updatedOrder });
  }

  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone');

  res.json({
    success: true,
    data: updated,
    message: 'Status updated',
  });
});

/**
 * Admin: PATCH /api/v1/orders/:orderId/assign
 * Body: { riderId: string, status?: 'pending' | 'processing' | 'out_for_delivery' | 'delivered' }
 * Prevents double assignment. Sets status to 'processing' (Assigned) when assigning rider.
 */
const assignRiderToOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { riderId, status } = req.body || {};

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const User = require('../models/User');
  if (riderId) {
    if (order.assignedRider && order.assignedRider.toString() !== riderId) {
      return res.status(400).json({
        success: false,
        message: 'Order is already assigned to another rider. Reassignment not allowed.',
      });
    }
    const rider = await User.findById(riderId).select('role');
    if (!rider || rider.role !== 'rider') {
      return res.status(400).json({ success: false, message: 'Invalid rider' });
    }
    order.assignedRider = riderId;
    order.status = 'processing';
    order.deliveryStatus = 'Assigned';
  }

  if (status && ['pending', 'processing', 'out_for_delivery', 'delivered'].includes(status)) {
    order.status = status;
    const statusMap = {
      pending: 'Pending',
      processing: 'Assigned',
      out_for_delivery: 'PickedUp',
      delivered: 'Delivered',
    };
    order.deliveryStatus = statusMap[status] || order.deliveryStatus;
  }

  await order.save();

  const io = getIO();
  if (io) {
    const updatedOrder = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('assignedRider', 'name email phone')
      .lean();
    io.emit('orderUpdate', { order: updatedOrder });
  }
  const updated = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone');

  res.json({
    success: true,
    data: updated,
    message: order.assignedRider ? 'Rider assigned' : 'Order updated',
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

  const User = require('../models/User');
  const rider = await User.findById(riderId).select('role');
  if (!rider || rider.role !== 'rider') {
    return res.status(400).json({ success: false, message: 'Invalid rider' });
  }

  const result = await Order.updateMany(
    { _id: { $in: orderIds } },
    { $set: { assignedRider: riderId } }
  );

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

module.exports = {
  createOrder,
  getMyOrders,
  adminGetOrders,
  getRiderAssignedOrders,
  getRiderActiveOrders,
  updateOrderStatus,
  assignRiderToOrder,
  bulkAssignOrders,
  initiateKhaltiForOrder,
};

