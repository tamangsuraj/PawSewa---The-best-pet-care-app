const ChatUnreadState = require('../models/ChatUnreadState');
const User = require('../models/User');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const logger = require('../utils/logger');

const PREFIX_CONV = 'c:';
const PREFIX_REQ = 'r:';
const PREFIX_VET = 'v:';

function convKey(conversationId) {
  return `${PREFIX_CONV}${String(conversationId)}`;
}

function requestKey(requestId) {
  return `${PREFIX_REQ}${String(requestId)}`;
}

function vetDirectKey(ownerId, vetId) {
  return `${PREFIX_VET}${String(ownerId)}:${String(vetId)}`;
}

function sumThreads(threads) {
  if (!threads || typeof threads !== 'object') return 0;
  return Object.values(threads).reduce((a, b) => a + (Number(b) || 0), 0);
}

async function loadOrCreate(userId) {
  const uid = String(userId);
  let doc = await ChatUnreadState.findOne({ user: uid });
  if (!doc) {
    doc = await ChatUnreadState.create({ user: uid, threads: {} });
  }
  return doc;
}

function normalizeThreads(raw) {
  const t = raw && typeof raw === 'object' ? { ...raw } : {};
  return t;
}

/**
 * @param {import('socket.io').Server|null|undefined} io
 * @param {string} recipientUserId
 * @param {string} threadKey
 * @param {{ senderName?: string, preview?: string, conversationId?: string|null, requestId?: string|null, ownerId?: string|null, vetId?: string|null, threadType?: string }} meta
 */
async function bumpUnread(io, recipientUserId, threadKey, meta = {}) {
  if (!recipientUserId || !threadKey) return null;
  const rid = String(recipientUserId);
  try {
    const doc = await loadOrCreate(rid);
    const threads = normalizeThreads(doc.threads);
    threads[threadKey] = (Number(threads[threadKey]) || 0) + 1;
    doc.threads = threads;
    doc.markModified('threads');
    await doc.save();
    const totalUnread = sumThreads(threads);
    if (io) {
      io.to(`user:${rid}`).emit('new_message_notification', {
        chatId: threadKey,
        conversationId: meta.conversationId ?? null,
        requestId: meta.requestId ?? null,
        vetDirect:
          meta.ownerId && meta.vetId
            ? { ownerId: String(meta.ownerId), vetId: String(meta.vetId) }
            : null,
        senderName: meta.senderName || 'Someone',
        preview: String(meta.preview || '').slice(0, 220),
        totalUnread,
        threadType: meta.threadType || 'message',
      });
    }
    return totalUnread;
  } catch (e) {
    logger.warn('[chatUnread] bumpUnread', e?.message);
    return null;
  }
}

async function clearUnread(io, userId, threadKey) {
  if (!userId || !threadKey) return 0;
  const uid = String(userId);
  try {
    const doc = await ChatUnreadState.findOne({ user: uid });
    if (!doc) return 0;
    const threads = normalizeThreads(doc.threads);
    if (!(threadKey in threads)) {
      const totalUnread = sumThreads(threads);
      if (io) {
        io.to(`user:${uid}`).emit('unread_sync', { totalUnread, clearedChatId: threadKey });
      }
      return totalUnread;
    }
    delete threads[threadKey];
    doc.threads = threads;
    doc.markModified('threads');
    await doc.save();
    const totalUnread = sumThreads(threads);
    if (io) {
      io.to(`user:${uid}`).emit('unread_sync', { totalUnread, clearedChatId: threadKey });
    }
    return totalUnread;
  } catch (e) {
    logger.warn('[chatUnread] clearUnread', e?.message);
    return 0;
  }
}

async function setUnread(io, userId, threadKey, count) {
  if (!userId || !threadKey) return 0;
  const uid = String(userId);
  const n = Math.max(Number(count) || 0, 0);
  try {
    const doc = await loadOrCreate(uid);
    const threads = normalizeThreads(doc.threads);
    if (n <= 0) {
      delete threads[threadKey];
    } else {
      threads[threadKey] = n;
    }
    doc.threads = threads;
    doc.markModified('threads');
    await doc.save();
    const totalUnread = sumThreads(threads);
    if (io) {
      io.to(`user:${uid}`).emit('unread_sync', { totalUnread, updatedChatId: threadKey });
    }
    return totalUnread;
  } catch (e) {
    logger.warn('[chatUnread] setUnread', e?.message);
    return 0;
  }
}

async function getSummaryForUser(userId) {
  const doc = await ChatUnreadState.findOne({ user: String(userId) }).lean();
  const threads = normalizeThreads(doc?.threads);
  return {
    totalUnread: sumThreads(threads),
    byChatId: threads,
  };
}

async function listAdminUserIds() {
  const rows = await User.find({ role: { $in: ['admin', 'ADMIN'] } })
    .select('_id')
    .lean();
  return rows.map((r) => r._id.toString());
}

/**
 * Customer sent on SUPPORT — notify assigned partner + all admins (shared inbox).
 */
function refId(ref) {
  if (ref == null) return '';
  if (typeof ref === 'object' && ref._id != null) return String(ref._id);
  return String(ref);
}

async function bumpSupportInbound(io, conversation, senderName, preview) {
  const convId = conversation._id.toString();
  const key = convKey(convId);
  const partnerId = refId(conversation.partner);
  const adminIds = await listAdminUserIds();
  const targets = new Set([...(partnerId ? [partnerId] : []), ...adminIds]);
  const meta = {
    senderName,
    preview,
    conversationId: convId,
    threadType: 'support',
  };
  for (const uid of targets) {
    await bumpUnread(io, uid, key, meta);
  }
}

/** Admin / partner replied — only customer gets unread. */
async function bumpSupportOutbound(io, customerId, senderName, preview, conversationId) {
  const key = convKey(String(conversationId));
  await bumpUnread(io, customerId, key, {
    senderName,
    preview,
    conversationId: String(conversationId),
    threadType: 'support',
  });
}

/**
 * Any staff (partner + admins) marks support thread read → clear for all who share inbox.
 */
async function clearSupportThreadForStaff(io, conversationId) {
  const conv = await MarketplaceConversation.findById(conversationId).select('type partner').lean();
  if (!conv || conv.type !== 'SUPPORT') return;
  const key = convKey(conversationId);
  const partnerId = conv.partner.toString();
  const adminIds = await listAdminUserIds();
  const targets = new Set([partnerId, ...adminIds]);
  for (const uid of targets) {
    await clearUnread(io, uid, key);
  }
}

module.exports = {
  PREFIX_CONV,
  PREFIX_REQ,
  PREFIX_VET,
  convKey,
  requestKey,
  vetDirectKey,
  bumpUnread,
  clearUnread,
  setUnread,
  getSummaryForUser,
  bumpSupportInbound,
  bumpSupportOutbound,
  clearSupportThreadForStaff,
};
