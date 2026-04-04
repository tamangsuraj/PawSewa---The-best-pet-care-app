const asyncHandler = require('express-async-handler');
const CustomerCareConversation = require('../models/CustomerCareConversation');
const CustomerCareMessage = require('../models/CustomerCareMessage');
const User = require('../models/User');
const { getIO } = require('../sockets/socketStore');
const {
  ensureDefaultCustomerCareConversation,
  appendMessageAndNotify,
  resolveCareAdminId,
} = require('../services/customerCareService');

/**
 * @desc Pet owner: my Customer Care thread (creates if missing)
 * @route GET /api/v1/customer-care/mine
 */
const getMine = asyncHandler(async (req, res) => {
  const conv = await ensureDefaultCustomerCareConversation(req.user._id);
  if (!conv) {
    res.status(503);
    throw new Error('Customer Care is not configured. Ask an administrator to set CUSTOMER_CARE_ADMIN_ID.');
  }

  const populated = await CustomerCareConversation.findById(conv._id)
    .populate('careAdmin', 'name email profilePicture')
    .lean();

  const messages = await CustomerCareMessage.find({ conversation: conv._id })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    data: {
      conversation: populated,
      messages: messages.map((m) => ({
        _id: m._id,
        conversation: m.conversation,
        senderId: m.senderId,
        receiverId: m.receiverId,
        text: m.text,
        timestamp: m.createdAt,
      })),
      careContact: {
        _id: populated.careAdmin?._id,
        name: populated.careAdmin?.name || 'Customer Care',
        profilePicture: populated.careAdmin?.profilePicture || null,
      },
    },
  });
});

/**
 * @desc Admin: list customer threads sorted by latest message
 * @route GET /api/v1/customer-care/conversations
 */
const listConversationsAdmin = asyncHandler(async (req, res) => {
  const lastMsg = await CustomerCareMessage.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversation',
        lastText: { $first: '$text' },
        lastAt: { $first: '$createdAt' },
      },
    },
  ]);
  const lastByConv = new Map(lastMsg.map((x) => [String(x._id), x]));

  const convs = await CustomerCareConversation.find({})
    .populate('customer', 'name email phone profilePicture')
    .sort({ updatedAt: -1 })
    .lean();

  const sorted = [...convs].sort((a, b) => {
    const ta = lastByConv.get(String(a._id))?.lastAt || a.updatedAt || 0;
    const tb = lastByConv.get(String(b._id))?.lastAt || b.updatedAt || 0;
    return new Date(tb) - new Date(ta);
  });

  res.json({
    success: true,
    data: sorted.map((c) => {
      const last = lastByConv.get(String(c._id));
      return {
        ...c,
        lastMessagePreview: last?.lastText || '',
        lastMessageAt: last?.lastAt || c.updatedAt,
      };
    }),
  });
});

/**
 * @desc Messages for a conversation (admin or participant)
 * @route GET /api/v1/customer-care/conversations/:id/messages
 */
const getMessages = asyncHandler(async (req, res) => {
  const conv = await CustomerCareConversation.findById(req.params.id);
  if (!conv) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  const uid = req.user._id.toString();
  const isParticipant =
    conv.customer.toString() === uid || conv.careAdmin.toString() === uid;
  const isAdmin = req.user.role === 'admin';

  if (!isParticipant && !isAdmin) {
    res.status(403);
    throw new Error('Not allowed');
  }

  const messages = await CustomerCareMessage.find({ conversation: conv._id })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    data: messages.map((m) => ({
      _id: m._id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      text: m.text,
      timestamp: m.createdAt,
    })),
  });
});

/**
 * @desc Send via REST (socket still preferred for realtime)
 * @route POST /api/v1/customer-care/conversations/:id/messages
 */
const postMessage = asyncHandler(async (req, res) => {
  const { text } = req.body || {};
  const conv = await CustomerCareConversation.findById(req.params.id);
  if (!conv) {
    res.status(404);
    throw new Error('Conversation not found');
  }

  const uid = req.user._id.toString();
  const isParticipant =
    conv.customer.toString() === uid || conv.careAdmin.toString() === uid;
  const isAdmin = req.user.role === 'admin';

  if (!isParticipant && !isAdmin) {
    res.status(403);
    throw new Error('Not allowed');
  }

  const io = getIO();
  const msg = await appendMessageAndNotify({
    conversation: conv,
    senderId: req.user._id,
    text,
    io,
  });

  res.status(201).json({
    success: true,
    data: {
      _id: msg._id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      text: msg.text,
      timestamp: msg.createdAt,
    },
  });
});

/**
 * @desc Care admin profile for apps (avatar URL, display name)
 * @route GET /api/v1/customer-care/care-profile
 */
const getCareProfile = asyncHandler(async (req, res) => {
  const careAdminId = await resolveCareAdminId();
  if (!careAdminId) {
    return res.json({ success: true, data: null });
  }
  const u = await User.findById(careAdminId).select('name profilePicture email').lean();
  res.json({
    success: true,
    data: u
      ? {
          _id: u._id,
          name: u.name || 'Customer Care',
          profilePicture: u.profilePicture || null,
        }
      : null,
  });
});

module.exports = {
  getMine,
  listConversationsAdmin,
  getMessages,
  postMessage,
  getCareProfile,
};
