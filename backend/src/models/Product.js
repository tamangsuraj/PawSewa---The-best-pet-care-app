const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stockQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    /** Store owner (shop_owner) for marketplace / seller chat. */
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /** Optional alias for seller (vendor) — same ref as [seller] for APIs that send vendorId. */
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    isAvailable: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    /**
     * Marketplace filters (Shop UI). Empty / missing = applies to all pet types.
     * Kept in sync from targetPets for dog/cat/rabbit filters.
     */
    petTypes: {
      type: [
        {
          type: String,
          enum: ['dog', 'cat', 'rabbit'],
        },
      ],
      default: [],
    },
    /**
     * Target species for personalization (uppercase: DOG, CAT, RABBIT, …).
     * Empty array = universal (all pets).
     */
    targetPets: {
      type: [
        {
          type: String,
          enum: ['DOG', 'CAT', 'RABBIT', 'BIRD', 'HAMSTER', 'FISH', 'OTHER'],
        },
      ],
      default: [],
    },
    /** Free-form merchandising tags (e.g. Wellness, Organic). */
    tags: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: [],
    },
    /** Uppercase pill on product card (e.g. NATURAL, HEALTH). Optional. */
    badge: {
      type: String,
      trim: true,
      maxlength: 32,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Text search on name + description
productSchema.index({ name: 'text', description: 'text' });

// eslint-disable-next-line no-console
console.log('[BACKEND] Product schema updated with targetPets and tags.');

module.exports = mongoose.model('Product', productSchema, 'products');

