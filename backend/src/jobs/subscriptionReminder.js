const PetOwnerSubscription = require('../models/PetOwnerSubscription');
const { sendMulticastToUser } = require('../utils/fcm');
const logger = require('../utils/logger');
async function runSubscriptionRenewalReminders() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const due30 = await PetOwnerSubscription.find({
    status: { $in: ['active', 'cancelling'] },
    endDate: { $gte: now, $lte: in30 },
    renewalReminder30Sent: { $ne: true },
  }).select('user endDate');

  for (const sub of due30) {
    try {
      await sendMulticastToUser(sub.user, {
        title: 'Care plan renewal',
        body: 'Your care plan renews in 30 days. Tap to manage.',
        data: { type: 'subscription_renewal', id: String(sub._id) },
      });
      sub.renewalReminder30Sent = true;
      await sub.save({ validateBeforeSave: false });
    } catch (e) {
      logger.warn('30-day subscription reminder failed:', e?.message || String(e));
    }
  }

  const due7 = await PetOwnerSubscription.find({
    status: { $in: ['active', 'cancelling'] },
    endDate: { $gte: now, $lte: in7 },
    renewalReminder7Sent: { $ne: true },
  }).select('user endDate');

  for (const sub of due7) {
    try {
      await sendMulticastToUser(sub.user, {
        title: 'Care plan renewal',
        body: 'Your care plan renews in 7 days. Tap to manage.',
        data: { type: 'subscription_renewal', id: String(sub._id) },
      });
      sub.renewalReminder7Sent = true;
      await sub.save({ validateBeforeSave: false });
    } catch (e) {
      logger.warn('7-day subscription reminder failed:', e?.message || String(e));
    }
  }
}

module.exports = { runSubscriptionRenewalReminders };
