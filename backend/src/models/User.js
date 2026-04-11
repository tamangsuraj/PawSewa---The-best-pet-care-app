const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

function normalizeRole(role) {
  const r = String(role || '').trim();
  if (!r) return r;
  const upper = r.toUpperCase();
  if (upper === 'CUSTOMER' || r === 'customer') return 'pet_owner';
  if (upper === 'VET' || r === 'vet') return 'veterinarian';
  if (upper === 'ADMIN') return 'admin';
  if (upper === 'RIDER') return 'rider';
  return r.toLowerCase();
}

/** Stored role values after normalization (no enum mismatch on legacy CUSTOMER / VET / etc.). */
const ALLOWED_ROLES = [
  'pet_owner',
  'veterinarian',
  'admin',
  'shop_owner',
  'care_service',
  'rider',
  'hostel_owner',
  'service_provider',
  'groomer',
  'trainer',
  'facility_owner',
  'customer',
  'vet',
];

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
      default: 'pet_owner',
      validate: {
        validator(v) {
          const n = normalizeRole(v);
          return ALLOWED_ROLES.includes(n);
        },
        message: 'Invalid role for this user',
      },
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
    yearsOfExperience: {
      type: Number,
      min: 0,
      default: 0,
    },
    credentials: {
      type: String,
      trim: true,
      maxlength: 500,
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
    /** Short-lived code for passwordless login (separate from registration OTP). */
    loginOtp: {
      type: String,
      select: false,
    },
    loginOtpExpires: {
      type: Date,
      select: false,
    },
    // Alias field expected by some clients/specs
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
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
    // FCM device tokens for push (pet owner app registers; max 5 kept)
    fcmTokens: {
      type: [String],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Normalize role before validation/save so legacy CUSTOMER / VET / ADMIN always map correctly.
userSchema.pre('validate', function normalizeRoleField() {
  if (this.role) this.role = normalizeRole(this.role);
});

function normalizeRoleInUpdate(update) {
  if (!update || typeof update !== 'object') return;
  if (update.$set && update.$set.role != null) {
    update.$set.role = normalizeRole(update.$set.role);
  }
  if (update.role != null) {
    update.role = normalizeRole(update.role);
  }
}

['findOneAndUpdate', 'updateOne', 'updateMany'].forEach((hook) => {
  userSchema.pre(hook, function (next) {
    try {
      normalizeRoleInUpdate(this.getUpdate());
    } catch (_) {
      /* ignore */
    }
    next();
  });
});

// Track brand-new documents for post-save hooks (isNew is false after save).
userSchema.pre('save', function () {
  if (this.isNew) {
    this.$locals._pawsewaJustInserted = true;
  }
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.post('save', async function (doc) {
  if (!doc.$locals._pawsewaJustInserted) return;
  delete doc.$locals._pawsewaJustInserted;
  const { ensureDefaultCustomerCareConversation, isPetOwnerRole } = require('../services/customerCareService');
  const logger = require('../utils/logger');
  if (!isPetOwnerRole(doc.role)) return;
  try {
    await ensureDefaultCustomerCareConversation(doc._id);
  } catch (e) {
    logger.error('Chat Engine: Default conversation setup failed for User', String(doc._id), e?.message || String(e));
  }
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
