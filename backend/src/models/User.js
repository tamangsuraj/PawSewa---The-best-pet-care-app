const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['pet_owner', 'veterinarian', 'admin', 'shop_owner', 'care_service', 'rider', 'hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner'],
      default: 'pet_owner',
    },
    phone: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    // Veterinarian specific fields
    clinicLocation: {
      type: String,
      trim: true,
    },
    specialization: {
      type: String,
      trim: true,
    },
    specialty: {
      type: String,
      trim: true,
    },
    clinicName: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    clinicAddress: {
      type: String,
      trim: true,
    },
    profilePicture: {
      type: String,
      trim: true,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    // Dispatcher Model Fields (Admin-controlled)
    currentShift: {
      type: String,
      enum: ['Morning', 'Evening', 'Night', 'Off'],
      default: 'Off',
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    workingHours: {
      open: {
        type: String,
        trim: true,
      },
      close: {
        type: String,
        trim: true,
      },
      days: [{
        type: String,
        trim: true,
      }],
    },
    // Shop Owner specific fields
    shopName: {
      type: String,
      trim: true,
    },
    businessLicense: {
      type: String,
      trim: true,
    },
    businessLicenseVerified: {
      type: Boolean,
      default: false,
    },
    // Care Service specific fields
    serviceType: {
      type: String,
      enum: ['Boarding', 'Grooming', 'Both'],
      trim: true,
    },
    facilityName: {
      type: String,
      trim: true,
    },
    // Rider specific fields
    vehicleType: {
      type: String,
      trim: true,
    },
    licenseNumber: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Provider subscription (for hostel_owner, service_provider, groomer, trainer, facility_owner)
    subscriptionStatus: {
      type: String,
      enum: ['Active', 'Expired', 'None'],
      default: 'None',
    },
    listingExpiry: {
      type: Date,
      default: null,
    },
    liveLocation: {
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
      updatedAt: { type: Date },
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    // Saved addresses for delivery/visit (Shop, Appointments)
    addresses: [
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        street: { type: String, trim: true },
        landmark: { type: String, trim: true },
        label: { type: String, trim: true, default: 'Home' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to match password (alias for comparePassword)
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
