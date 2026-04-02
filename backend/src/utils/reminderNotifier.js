const Pet = require('../models/Pet');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('./logger');
const { sendMulticastNotification, isFcmConfigured } = require('../config/fcm');

function windowFromNow({ hoursFromNowStart, windowMinutes }) {
  const now = new Date();
  const start = new Date(now.getTime() + hoursFromNowStart * 60 * 60 * 1000);
  const end = new Date(start.getTime() + windowMinutes * 60 * 1000);
  return { start, end };
}

function fmtCategory(c) {
  switch (c) {
    case 'vaccination':
      return 'Vaccination';
    case 'deworming':
      return 'Deworming';
    case 'flea_tick':
      return 'Flea/Tick';
    case 'checkup':
      return 'Vet Checkup';
    default:
      return 'Reminder';
  }
}

async function scanAndNotifyReminders24h() {
  const { start, end } = windowFromNow({ hoursFromNowStart: 24, windowMinutes: 60 });

  // Find reminders due ~24h from now (in a 60-minute window)
  const dueRows = await Pet.aggregate([
    { $unwind: '$reminders' },
    {
      $match: {
        'reminders.status': 'upcoming',
        'reminders.dueDate': { $gte: start, $lt: end },
      },
    },
    {
      $project: {
        petId: '$_id',
        petName: '$name',
        ownerId: '$owner',
        reminderId: '$reminders._id',
        category: '$reminders.category',
        title: '$reminders.title',
        dueDate: '$reminders.dueDate',
      },
    },
  ]);

  if (!Array.isArray(dueRows) || dueRows.length === 0) return { scanned: 0, created: 0 };

  let created = 0;
  let pushSent = 0;
  for (const row of dueRows) {
    try {
      const title = 'Pet health reminder';
      const categoryLabel = fmtCategory(row.category);
      const dueIso = row.dueDate instanceof Date ? row.dueDate.toISOString().slice(0, 10) : '';
      const message = `${row.petName}: ${categoryLabel} due on ${dueIso}.`;

      await Notification.create({
        user: row.ownerId,
        title,
        message,
        type: 'reminder',
        reminderPet: row.petId,
        reminderId: row.reminderId,
        reminderDueDate: row.dueDate,
      });
      created += 1;

      if (isFcmConfigured()) {
        const owner = await User.findById(row.ownerId).select('+fcmTokens').lean();
        const tokens = Array.isArray(owner?.fcmTokens) ? owner.fcmTokens : [];
        if (tokens.length > 0) {
          const r = await sendMulticastNotification(tokens, {
            title,
            body: message,
            data: {
              type: 'reminder',
              petId: String(row.petId),
              reminderId: String(row.reminderId),
            },
          });
          pushSent += r.sent;
        }
      }
    } catch (e) {
      // Ignore duplicates (unique index). Log unexpected errors.
      const msg = e && e.code === 11000 ? null : e?.message || String(e);
      if (msg) logger.warn('Reminder Notifier: Failed to create notification', msg);
    }
  }

  logger.info(
    'Reminder Notifier: 24h window',
    start.toISOString(),
    'to',
    end.toISOString(),
    'created',
    created,
    'notifications',
    'FCM',
    pushSent,
    'sent'
  );

  return { scanned: dueRows.length, created, pushSent };
}

module.exports = {
  scanAndNotifyReminders24h,
};

