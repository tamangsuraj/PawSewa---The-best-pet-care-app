const mongoose = require('mongoose');

const trainingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
    tutorName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', default: null },
  },
  { timestamps: true }
);

trainingSchema.index({ title: 1 });
trainingSchema.index({ difficulty: 1 });

module.exports = mongoose.model('Training', trainingSchema, 'trainings');
