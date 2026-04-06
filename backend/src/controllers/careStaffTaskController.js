const asyncHandler = require('express-async-handler');
const CareStaffTask = require('../models/CareStaffTask');

function normalizeDateKey(v) {
  const s = String(v || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function defaultTasks() {
  return [
    { category: 'cleaning', title: 'Clean rooms / kennels', done: false },
    { category: 'cleaning', title: 'Sanitize feeding bowls', done: false },
    { category: 'walks', title: 'Morning walk schedule', done: false },
    { category: 'walks', title: 'Evening walk schedule', done: false },
    { category: 'grooming', title: 'Grooming tasks (as needed)', done: false },
  ];
}

/** GET /api/v1/care-staff-tasks?date=YYYY-MM-DD */
const getCareStaffTasks = asyncHandler(async (req, res) => {
  const dateKey = normalizeDateKey(req.query.date);
  if (!dateKey) return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD)' });
  const ownerId = req.user?._id;
  const doc =
    (await CareStaffTask.findOne({ ownerId, dateKey }).lean()) ||
    (await CareStaffTask.create({ ownerId, dateKey, tasks: defaultTasks() }).then((d) => d.toObject()));
  res.json({ success: true, data: doc });
});

/** PUT /api/v1/care-staff-tasks?date=YYYY-MM-DD  Body: { tasks: [{category,title,done}] } */
const putCareStaffTasks = asyncHandler(async (req, res) => {
  const dateKey = normalizeDateKey(req.query.date);
  if (!dateKey) return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD)' });
  const ownerId = req.user?._id;
  const raw = Array.isArray(req.body?.tasks) ? req.body.tasks : null;
  if (!raw) return res.status(400).json({ success: false, message: 'tasks (array) is required' });

  const tasks = raw
    .filter((t) => t && typeof t === 'object' && String(t.title || '').trim())
    .slice(0, 60)
    .map((t) => {
      const done = Boolean(t.done);
      return {
        category: String(t.category || 'general').trim().slice(0, 40),
        title: String(t.title).trim().slice(0, 120),
        done,
        doneAt: done ? new Date() : null,
      };
    });

  const doc = await CareStaffTask.findOneAndUpdate(
    { ownerId, dateKey },
    { $set: { tasks } },
    { new: true, upsert: true }
  ).lean();

  res.json({ success: true, data: doc });
});

module.exports = { getCareStaffTasks, putCareStaffTasks };

