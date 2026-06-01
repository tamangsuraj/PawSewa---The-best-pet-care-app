const mongoose = require('mongoose');
const serviceCatalogueSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true },
  category: {
    type: String,
    enum: ['home_visit', 'vaccination', 'grooming', 'consultation', 'other'],
    default: 'home_visit',
  },
  duration: { type: Number },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ServiceCatalogue', serviceCatalogueSchema);
