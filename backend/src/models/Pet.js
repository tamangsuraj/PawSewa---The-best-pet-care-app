const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide pet name'],
      trim: true,
    },
    species: {
      type: String,
      required: [true, 'Please provide species'],
      enum: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Hamster', 'Fish', 'Other'],
    },
    breed: {
      type: String,
      trim: true,
    },
    dob: {
      type: Date,
    },
    age: {
      type: Number,
      min: 0,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: [true, 'Please provide gender'],
    },
    weight: {
      type: Number,
      min: 0,
    },
    photoUrl: {
      type: String,
      default: '',
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
    },
    medicalConditions: {
      type: String,
      trim: true,
    },
    behavioralNotes: {
      type: String,
      trim: true,
    },
    isVaccinated: {
      type: Boolean,
      default: false,
    },
    medicalHistory: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Pet', petSchema);
