/**
 * Centralized Socket.io emits for shop orders (admin room + role-specific user rooms).
 * Keeps paymentController and orderController from duplicating room logic.
 */
const { getIO } = require('../sockets/socketStore');
const Order = require('../models/Order');

/**
 * @param {import('mongoose').Types.ObjectId|string} orderId
 * @param {'update'|'new_order'|'paid'|'assign_rider'|'assign_seller'|'seller_confirmed'} kind
 */
async function broadcastShopOrder(orderId, kind = 'update') {
  const io = getIO();
  if (!io || !orderId) return;

  const order = await Order.findById(orderId)
    .populate('user', 'name email phone')
    .populate('assignedRider', 'name email phone')
    .populate('assignedSeller', 'name email phone')
    .populate('items.product', 'name images')
    .lean();

  if (!order) return;

  const payload = { order };

  io.emit('orderUpdate', payload);
  io.to('admin_room').emit('orderUpdate', payload);

  if (kind === 'new_order') {
    io.to('admin_room').emit('new:order', payload);
  }
  if (kind === 'paid') {
    io.to('admin_room').emit('order:paid', payload);
  }

  if (kind === 'assign_rider' && order.assignedRider) {
    const rid =
      order.assignedRider._id?.toString() || String(order.assignedRider);
    io.to(`user:${rid}`).emit('job:available', payload);
    io.to(`user:${rid}`).emit('order:assigned_rider', payload);
  }

  if (kind === 'assign_seller' && order.assignedSeller) {
    const sid =
      order.assignedSeller._id?.toString() || String(order.assignedSeller);
    io.to(`user:${sid}`).emit('order:assigned_seller', payload);
  }

  if (kind === 'seller_confirmed') {
    io.to('admin_room').emit('order:seller_confirmed', payload);
  }
}

module.exports = { broadcastShopOrder };
