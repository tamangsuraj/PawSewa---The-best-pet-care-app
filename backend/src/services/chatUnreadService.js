const mongoose = require('mongoose');
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
  const sectionUnread = { support: 0, vets: 0, care: 0, sellers: 0, delivery: 0 };

  const convEntries = [];
  for (const [key, raw] of Object.entries(threads)) {
    const n = Number(raw) || 0;
    if (n <= 0) continue;
    if (key.startsWith(PREFIX_VET)) {
      sectionUnread.vets += n;
      continue;
    }
    if (key.startsWith(PREFIX_REQ)) {
      sectionUnread.support += n;
      continue;
    }
    if (key.startsWith(PREFIX_CONV)) {
      convEntries.push({ id: key.slice(PREFIX_CONV.length), n });
    }
  }

  if (convEntries.length > 0) {
    const ids = convEntries.map((e) => e.id).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (ids.length > 0) {
      const convs = await MarketplaceConversation.find({ _id: { $in: ids } })
        .select('type')
        .lean();
      const typeById = new Map(convs.map((c) => [c._id.toString(), c.type]));
      for (const { id, n } of convEntries) {
        const type = typeById.get(id);
        if (type === 'SUPPORT') sectionUnread.support += n;
        else if (type === 'CARE') sectionUnread.care += n;
        else if (type === 'SELLER') sectionUnread.sellers += n;
        else if (type === 'DELIVERY') sectionUnread.delivery += n;
        else sectionUnread.support += n;
      }
    }
  }

  return {
    totalUnread: sumThreads(threads),
    byChatId: threads,
    sectionUnread,
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
