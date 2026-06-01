const AuditLog = require('../models/AuditLog');
const logAction = async ({ action, performedBy, targetModel, targetId, targetLabel, metadata }) => {
  try {
    await AuditLog.create({
      action,
      performedBy,
      targetModel,
      targetId,
      targetLabel,
      metadata,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
};

module.exports = { logAction };
