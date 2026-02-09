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
      enum: ['pet_owner', 'veterinarian', 'admin', 'shop_owner', 'care_service', 'rider'],
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
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
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
