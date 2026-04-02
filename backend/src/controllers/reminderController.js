const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Pet = require('../models/Pet');

function dayWindowUTC({ now = new Date(), daysFromNowStart = 0, daysLength = 1 }) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() + daysFromNowStart);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + daysLength);
  return { start, end };
}

async function listReminders({ start, end }) {
  return Pet.aggregate([
    { $unwind: '$reminders' },
    {
      $match: {
        'reminders.status': 'upcoming',
        'reminders.dueDate': { $gte: start, $lt: end },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'owner',
        foreignField: '_id',
        as: 'ownerDoc',
      },
    },
    { $unwind: { path: '$ownerDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        petId: '$_id',
        pawId: '$pawId',
        petName: '$name',
        species: '$species',
        ownerId: '$owner',
        ownerName: '$ownerDoc.name',
        ownerPhone: '$ownerDoc.phone',
        ownerEmail: '$ownerDoc.email',
        reminder: '$reminders',
      },
    },
    { $sort: { 'reminder.dueDate': 1 } },
  ]);
}

/**
 * Admin: Today's reminders (UTC day window).
 * GET /api/v1/reminders/admin/today
 */
const adminGetTodaysReminders = asyncHandler(async (req, res) => {
  const { start, end } = dayWindowUTC({ now: new Date(), daysFromNowStart: 0, daysLength: 1 });
  const rows = await listReminders({ start, end });
  res.json({
    success: true,
    window: { start: start.toISOString(), end: end.toISOString() },
    count: rows.length,
    data: rows,
  });
});

/**
 * Admin: Upcoming reminders for next N days (default 7).
 * GET /api/v1/reminders/admin/upcoming?days=7
 */
const adminGetUpcomingReminders = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);
  const { start, end } = dayWindowUTC({ now: new Date(), daysFromNowStart: 0, daysLength: days });
  const rows = await listReminders({ start, end });
  res.json({
    success: true,
    window: { start: start.toISOString(), end: end.toISOString() },
    count: rows.length,
    data: rows,
  });
});

/**
 * Admin/Vet: Update a reminder lifecycle (mark called/completed) or override due date.
 * PATCH /api/v1/reminders/pets/:petId/:reminderId
 * Body: { called?: boolean, status?: 'upcoming'|'completed'|'skipped', dueDate?: ISO string, overrideReason?: string }
 */
const updatePetReminder = asyncHandler(async (req, res) => {
  const { petId, reminderId } = req.params;
  if (!mongoose.isValidObjectId(petId) || !mongoose.isValidObjectId(reminderId)) {
    res.status(400);
    throw new Error('Invalid petId or reminderId');
  }

  const body = req.body || {};
  const set = {};

  if (typeof body.called === 'boolean') {
    set['reminders.$.called'] = body.called;
    set['reminders.$.calledAt'] = body.called ? new Date() : null;
  }

  if (typeof body.status === 'string') {
    const s = body.status.trim().toLowerCase();
    if (!['upcoming', 'completed', 'skipped'].includes(s)) {
      res.status(400);
      throw new Error('Invalid status');
    }
    set['reminders.$.status'] = s;
    if (s === 'completed') {
      set['reminders.$.completedAt'] = new Date();
    }
  }

  if (body.dueDate) {
    const d = new Date(body.dueDate);
    if (Number.isNaN(d.getTime())) {
      res.status(400);
      throw new Error('Invalid dueDate');
    }
    set['reminders.$.overriddenDueDate'] = d;
    set['reminders.$.dueDate'] = d;
    set['reminders.$.overrideReason'] = typeof body.overrideReason === 'string' ? body.overrideReason.trim().slice(0, 200) : '';
    set['reminders.$.overrideBy'] = req.user?._id;
    set['reminders.$.overrideByRole'] = req.user?.role ? String(req.user.role).toLowerCase() : 'unknown';
  }

  const updated = await Pet.findOneAndUpdate(
    { _id: petId, 'reminders._id': reminderId },
    { $set: set },
    { new: true }
  ).lean();

  if (!updated) {
    res.status(404);
    throw new Error('Pet or reminder not found');
  }

  const reminder = (updated.reminders || []).find((r) => String(r._id) === String(reminderId));
  res.json({ success: true, data: { petId, reminder } });
});

module.exports = {
  adminGetTodaysReminders,
  adminGetUpcomingReminders,
  updatePetReminder,
};

