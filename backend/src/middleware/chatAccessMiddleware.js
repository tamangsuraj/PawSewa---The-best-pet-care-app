const ServiceRequest = require('../models/ServiceRequest');
const Chat = require('../models/Chat');

/**
 * Internal helper: loads the serviceRequest and attaches:
 *   - req.serviceRequest
 *   - req.chatReadOnly (boolean)
 *
 * Rules:
 * - User must be owner (request.user), assignedStaff, or admin.
 * - When status === 'completed' and completedAt is >24h ago,
 *   chatReadOnly is true.
 */
async function loadChatContext(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Missing service request id',
      });
    }

    const request = await ServiceRequest.findById(id)
      .select('user assignedStaff status completedAt')
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found',
      });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const uid = user._id.toString();
    const isOwner = request.user?.toString() === uid;
    const isAssignedStaff = request.assignedStaff?.toString() === uid;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAssignedStaff && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not allowed to access this chat',
      });
    }

    let isReadOnly = false;
    if (request.status === 'completed' && request.completedAt) {
      const completedAt = new Date(request.completedAt);
      const diffMs = Date.now() - completedAt.getTime();
      const hours = diffMs / (1000 * 60 * 60);
      if (hours > 24) {
        isReadOnly = true;
      }
    }

    req.serviceRequest = request;
    req.chatReadOnly = isReadOnly;

    // Sync isReadOnly flag to Chat room if it exists
    try {
      await Chat.updateOne(
        { serviceRequest: request._id },
        { $set: { isReadOnly } }
      ).exec();
    } catch {
      // best-effort only
    }

    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chatAccessMiddleware] loadChatContext error:', err?.message || err);
    next(err);
  }
}

/**
 * verifyChatAccess
 * Use for read operations (fetching messages) – allows read-only access.
 */
async function verifyChatAccess(req, res, next) {
  await loadChatContext(req, res, next);
}

/**
 * verifyChatSendAccess
 * Use for write operations (sending messages) – blocks when read-only.
 */
async function verifyChatSendAccess(req, res, next) {
  await loadChatContext(req, res, async (err) => {
    if (err) return next(err);
    if (req.chatReadOnly) {
      return res.status(403).json({
        success: false,
        message: 'Chat window expired. You can no longer send messages for this request.',
      });
    }
    return next();
  });
}

module.exports = {
  verifyChatAccess,
  verifyChatSendAccess,
};

