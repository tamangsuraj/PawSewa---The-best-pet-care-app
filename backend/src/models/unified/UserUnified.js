/**
 * Unified User model for pawsewa_production.
 * Collection: users
 * Role enum: CUSTOMER, VET, RIDER, SERVICE_OWNER, ADMIN
 * SERVICE_OWNER covers Hostel, Grooming, Spa, Training owners.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    street: { type: String, trim: true },
    landmark: { type: String, trim: true },
    label: { type: String, trim: true, default: 'Home' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['CUSTOMER', 'VET', 'RIDER', 'SERVICE_OWNER', 'ADMIN'],
      default: 'CUSTOMER',
    },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    addresses: [addressSchema],
    // VET / SERVICE_OWNER fields
    clinicName: { type: String, trim: true },
    clinicLocation: { type: String, trim: true },
    specialization: { type: String, trim: true },
    profilePicture: { type: String, trim: true },
    currentShift: { type: String, enum: ['Morning', 'Evening', 'Night', 'Off'], default: 'Off' },
    isAvailable: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'users' }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('UserUnified', userSchema);
