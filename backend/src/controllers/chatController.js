const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const VetDirectMessage = require('../models/VetDirectMessage');
const {
  VET_ROLES,
  makeVetDirectRoomId,
  socketRoomName,
  collectVetIdsForOwner,
  collectOwnerIdsForVet,
  canOwnerChatWithVet,
  canVetChatWithOwner,
} = require('../utils/vetChatEligibility');
const { getIO } = require('../sockets/socketStore');
const { bumpUnread, vetDirectKey, getSummaryForUser } = require('../services/chatUnreadService');
const logger = require('../utils/logger');
const { lookupUserByEmailWithStats } = require('../services/supportUserLookupService');
const {
  getMessages: getCustomerCareConversationHistory,
} = require('./customerCareController');

/**
 * @route GET /api/v1/chats/my-vets
 * @access pet_owner
 */
const getMyVetsForChat = asyncHandler(async (req, res) => {
  const ownerId = req.user._id.toString();
  const vetIdStrings = await collectVetIdsForOwner(ownerId);
  if (vetIdStrings.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const vets = await User.find({
    _id: { $in: vetIdStrings },
    role: { $in: VET_ROLES },
  })
    .select('name profilePicture clinicName specialization specialty email phone')
    .lean();

  res.json({ success: true, data: vets });
});

/**
 * @route GET /api/v1/chats/my-patients
 * @access veterinarian
 */
const getMyPatientsForChat = asyncHandler(async (req, res) => {
  const vetId = req.user._id.toString();
  const ownerIdStrings = await collectOwnerIdsForVet(vetId);
  if (ownerIdStrings.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const owners = await User.find({
    _id: { $in: ownerIdStrings },
    role: { $in: ['pet_owner', 'customer'] },
  })
    .select('name profilePicture email phone')
    .lean();

  res.json({ success: true, data: owners });
});

/**
 * @route GET /api/v1/chats/vet-direct/messages?ownerId=&vetId=
 */
const getVetDirectMessages = asyncHandler(async (req, res) => {
  const { ownerId, vetId } = req.query;
  if (!ownerId || !vetId) {
    res.status(400);
    throw new Error('ownerId and vetId are required');
  }

  const uid = req.user._id.toString();
  const role = req.user.role;

  let allowed = false;
  if (role === 'pet_owner' && uid === String(ownerId)) {
    allowed = await canOwnerChatWithVet(ownerId, vetId);
  } else if ((role === 'veterinarian' || role === 'vet') && uid === String(vetId)) {
    allowed = await canVetChatWithOwner(vetId, ownerId);
  }

  if (!allowed) {
    res.status(403);
    throw new Error('Not allowed to view this conversation');
  }

  const roomId = makeVetDirectRoomId(ownerId, vetId);
  const messages = await VetDirectMessage.find({ roomId })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  res.json({
    success: true,
    data: {
      roomId,
      messages: messages.map((m) => ({
        _id: m._id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
      })),
    },
  });
});

/**
 * @route POST /api/v1/chats/vet-direct/messages
 * body: { ownerId, vetId, text }
 */
const postVetDirectMessage = asyncHandler(async (req, res) => {
  const { ownerId, vetId, text } = req.body || {};
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!ownerId || !vetId || !trimmed) {
    res.status(400);
    throw new Error('ownerId, vetId, and text are required');
  }

  const uid = req.user._id.toString();
  const role = req.user.role;

  let allowed = false;
  if (role === 'pet_owner' && uid === String(ownerId)) {
    allowed = await canOwnerChatWithVet(ownerId, vetId);
  } else if ((role === 'veterinarian' || role === 'vet') && uid === String(vetId)) {
    allowed = await canVetChatWithOwner(vetId, ownerId);
  }

  if (!allowed) {
    res.status(403);
    throw new Error('Not allowed to send in this conversation');
  }

  const roomId = makeVetDirectRoomId(ownerId, vetId);
  const msg = await VetDirectMessage.create({
    roomId,
    ownerUser: ownerId,
    vetUser: vetId,
    sender: req.user._id,
    text: trimmed,
  });

  const payload = {
    roomId,
    ownerId: String(ownerId),
    vetId: String(vetId),
    messageId: msg._id.toString(),
    sender: req.user._id.toString(),
    text: trimmed,
    timestamp: msg.createdAt || new Date(),
  };

  const io = getIO();
  if (io) {
    io.to(socketRoomName(ownerId, vetId)).emit('vet_direct_new_message', payload);
  }

  const recipientId = uid === String(ownerId) ? String(vetId) : String(ownerId);
  if (io && recipientId && recipientId !== uid) {
    await bumpUnread(io, recipientId, vetDirectKey(ownerId, vetId), {
      senderName: (req.user.name || 'Someone').trim(),
      preview: trimmed,
      ownerId: String(ownerId),
      vetId: String(vetId),
      threadType: 'vetdirect',
    });
  }

  logger.info(
    `[INFO] Vet-direct message saved room=${roomId} sender=${uid}`
  );

  res.status(201).json({
    success: true,
    data: {
      _id: msg._id,
      sender: msg.sender,
      text: msg.text,
      createdAt: msg.createdAt,
    },
  });
});

/**
 * @desc Admin: exact email → user + stats + existing support thread id
 * @route GET /api/v1/admin/support/user-lookup
 */
const findUserByEmail = asyncHandler(async (req, res, next) => {
  try {
    const data = await lookupUserByEmailWithStats(req.query.email);
    res.json({ success: true, data });
  } catch (e) {
    const code = e.statusCode;
    if (code === 400 || code === 404) {
      return res.status(code).json({ success: false, message: e.message });
    }
    next(e);
  }
});

/** PawSewa support thread history (same handler as customer-care messages). */
const getChatHistory = getCustomerCareConversationHistory;

/** @route GET /api/v1/chats/unread-summary */
const getUnreadSummary = asyncHandler(async (req, res) => {
  const summary = await getSummaryForUser(req.user._id);
  res.json({ success: true, data: summary });
});

module.exports = {
  getMyVetsForChat,
  getMyPatientsForChat,
  getVetDirectMessages,
  postVetDirectMessage,
  findUserByEmail,
  getChatHistory,
  getUnreadSummary,
};
