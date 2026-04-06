const mongoose = require('mongoose');

const callSessionSchema = new mongoose.Schema(
  {
    channelName: { type: String, required: true, trim: true, maxlength: 64 },
    durationSeconds: { type: Number, default: 0, min: 0 },
    callType: { type: String, enum: ['audio', 'video'], default: 'audio' },
    caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    callee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    careBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'CareBooking' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

callSessionSchema.index({ appointment: 1, createdAt: -1 });
callSessionSchema.index({ careBooking: 1, createdAt: -1 });
callSessionSchema.index({ caller: 1, createdAt: -1 });

module.exports = mongoose.model('CallSession', callSessionSchema, 'callsessions');
