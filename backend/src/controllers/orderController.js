const asyncHandler = require('express-async-handler');
const axios = require('axios');
const Order = require('../models/Order');
const Product = require('../models/Product');

const KHALTI_BASE_URL = process.env.KHALTI_BASE_URL || 'https://dev.khalti.com/api/v2';
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || '';
const KHALTI_PUBLIC_KEY = process.env.KHALTI_PUBLIC_KEY || '';

// POST /api/v1/orders
// Body: { items: [{ productId, quantity }], deliveryLocation: { address, coordinates: [lng, lat] } }
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const { items, deliveryLocation } = req.body || {};
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
    status: 'pending',
    paymentStatus: 'unpaid',
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
const adminGetOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const orders = await Order.find(filter)
    .populate('user', 'name email phone')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: orders });
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
  if (!KHALTI_SECRET_KEY) {
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
  const amountPaisa = Math.round(amountNpr * 100);
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
    `${KHALTI_BASE_URL.replace(/\/$/, '')}/epayment/initiate/`,
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

  res.json({
    success: true,
    data: {
      pidx,
      paymentUrl: payment_url,
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
  initiateKhaltiForOrder,
};

