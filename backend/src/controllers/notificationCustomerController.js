/**
 * In-app notifications for authenticated customers / partners (Mongo `notifications`).
 */
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');

const getMyNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
  const skip = Math.max(parseInt(String(req.query.skip || '0'), 10) || 0, 0);

  const items = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const unreadCount = await Notification.countDocuments({
    user: req.user._id,
    isRead: false,
  });

  res.json({
    success: true,
    data: {
      items,
      unreadCount,
    },
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error('Invalid notification id');
  }

  const doc = await Notification.findOneAndUpdate(
    { _id: id, user: req.user._id },
    { $set: { isRead: true } },
    { new: true }
  ).lean();

  if (!doc) {
    res.status(404);
    throw new Error('Notification not found');
  }

  res.json({ success: true, data: doc });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );

  res.json({
    success: true,
    data: { modifiedCount: result.modifiedCount },
  });
});

module.exports = {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
