const asyncHandler = require('express-async-handler');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const MarketplaceMessage = require('../models/MarketplaceMessage');
const User = require('../models/User');
const { getIO } = require('../sockets/socketStore');
const {
  ensureDefaultCustomerCareConversation,
  appendMessageAndNotify,
  resolveCareAdminId,
  toClientConversationShape,
} = require('../services/customerCareService');

function assertSupportConv(conv) {
  if (!conv || conv.type !== 'SUPPORT') {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }
}

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

  const populated = await MarketplaceConversation.findById(conv._id)
    .populate('partner', 'name email profilePicture')
    .lean();

  const clientConv = toClientConversationShape(populated);

  const messages = await MarketplaceMessage.find({ conversation: conv._id })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    data: {
      conversation: clientConv,
      messages: messages.map((m) => ({
        _id: m._id,
        conversation: m.conversation,
        senderId: m.sender,
        receiverId: m.receiver,
        text: m.content,
        timestamp: m.createdAt,
      })),
      careContact: {
        _id: populated.partner?._id,
        name: populated.partner?.name || 'Customer Care',
        profilePicture: populated.partner?.profilePicture || null,
      },
    },
  });
});

/**
 * @desc Admin: list customer threads sorted by latest message
 * @route GET /api/v1/customer-care/conversations
 */
const listConversationsAdmin = asyncHandler(async (req, res) => {
  const convs = await MarketplaceConversation.find({ type: 'SUPPORT' })
    .populate('customer', 'name email phone profilePicture')
    .populate('partner', 'name email profilePicture')
    .sort({ updatedAt: -1 })
    .lean();

  const ids = convs.map((c) => c._id);
  const lastMsg =
    ids.length === 0
      ? []
      : await MarketplaceMessage.aggregate([
          { $match: { conversation: { $in: ids } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: '$conversation',
              lastText: { $first: '$content' },
              lastAt: { $first: '$createdAt' },
            },
          },
        ]);
  const lastByConv = new Map(lastMsg.map((x) => [String(x._id), x]));

  const sorted = [...convs].sort((a, b) => {
    const ta = lastByConv.get(String(a._id))?.lastAt || a.updatedAt || 0;
    const tb = lastByConv.get(String(b._id))?.lastAt || b.updatedAt || 0;
    return new Date(tb) - new Date(ta);
  });

  res.json({
    success: true,
    data: sorted.map((c) => {
      const last = lastByConv.get(String(c._id));
      const shaped = toClientConversationShape(c);
      return {
        ...shaped,
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
  const conv = await MarketplaceConversation.findById(req.params.id);
  assertSupportConv(conv);

  const uid = req.user._id.toString();
  const isParticipant =
    conv.customer.toString() === uid || conv.partner.toString() === uid;
  const isAdmin = req.user.role === 'admin';

  if (!isParticipant && !isAdmin) {
    res.status(403);
    throw new Error('Not allowed');
  }

  const messages = await MarketplaceMessage.find({ conversation: conv._id })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    data: messages.map((m) => ({
      _id: m._id,
      senderId: m.sender,
      receiverId: m.receiver != null ? m.receiver : m.sender,
      text: m.content,
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
  const conv = await MarketplaceConversation.findById(req.params.id);
  assertSupportConv(conv);

  const uid = req.user._id.toString();
  const isParticipant =
    conv.customer.toString() === uid || conv.partner.toString() === uid;
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
      senderId: msg.sender,
      receiverId: msg.receiver,
      text: msg.content,
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
