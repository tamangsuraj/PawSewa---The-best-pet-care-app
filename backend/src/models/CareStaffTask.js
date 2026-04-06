const mongoose = require('mongoose');

const careStaffTaskSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** YYYY-MM-DD in local facility timezone (client-selected). */
    dateKey: { type: String, required: true, trim: true, maxlength: 10, index: true },
    tasks: {
      type: [
        {
          category: { type: String, trim: true, maxlength: 40, default: 'general' },
          title: { type: String, trim: true, maxlength: 120, required: true },
          done: { type: Boolean, default: false },
          doneAt: { type: Date, default: null },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

careStaffTaskSchema.index({ ownerId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('CareStaffTask', careStaffTaskSchema);

