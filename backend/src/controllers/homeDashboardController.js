/**
 * Aggregated home dashboard for customer mobile (single round-trip per pet).
 * @route GET /api/v1/pets/home-dashboard/:petId
 */
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Pet = require('../models/Pet');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const LiveLocation = require('../models/LiveLocation');

const SPECIES_TO_TARGET = {
  dog: 'DOG',
  cat: 'CAT',
  rabbit: 'RABBIT',
  bird: 'BIRD',
  hamster: 'HAMSTER',
  fish: 'FISH',
  other: 'OTHER',
};

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Derives vaccination-style alerts from the pet document (reminders + vaccination fields).
 * Aligns with customer Services tab logic — data lives on `pets`, not a separate vaccinations collection.
 */
function buildHealthAlertsForPet(pet) {
  const alerts = [];
  const now = new Date();
  const today = startOfDay(now);
  const petName = pet.name || 'Pet';

  const status = pet.vaccinationStatus;
  const nextRaw = pet.nextVaccinationDate;
  const nextDt = nextRaw ? new Date(nextRaw) : null;

  const overdueByStatus = status === 'Overdue';
  const overdueByDate =
    nextDt != null && !Number.isNaN(nextDt.getTime()) && startOfDay(nextDt) <= today && status !== 'Up to date';

  if (overdueByStatus || overdueByDate) {
    const datePart =
      nextDt && !Number.isNaN(nextDt.getTime()) ? ` (due ${nextDt.toISOString().split('T')[0]})` : '';
    alerts.push({
      severity: 'overdue',
      message: `${petName} is OVERDUE for Rabies Vaccine${datePart}. Schedule immediately.`,
      vaccineLabel: 'Rabies Vaccine',
    });
  }

  if (status === 'Due soon' && !overdueByStatus && !overdueByDate) {
    alerts.push({
      severity: 'upcoming',
      message: `${petName} has vaccination due soon. Book a visit to stay protected.`,
      vaccineLabel: 'Vaccination',
    });
  }

  const reminders = Array.isArray(pet.reminders) ? pet.reminders : [];
  for (const r of reminders) {
    if (r.category !== 'vaccination') {
      continue;
    }
    if (r.status === 'completed') {
      continue;
    }
    const dueRaw = r.dueDate;
    if (!dueRaw) {
      continue;
    }
    const due = new Date(dueRaw);
    if (Number.isNaN(due.getTime())) {
      continue;
    }
    const title = (r.title || 'Vaccination').trim();
    if (due < now) {
      const d0 = startOfDay(due);
      const days = Math.floor((today - d0) / 86400000);
      const rel = days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
      alerts.push({
        severity: 'overdue',
        message: `${petName} is OVERDUE for ${title}. Due ${rel}. Schedule immediately.`,
        vaccineLabel: title,
      });
    } else {
      const dueDay = startOfDay(due);
      const daysUntil = Math.round((dueDay - today) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 14) {
        const when =
          daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
        alerts.push({
          severity: 'upcoming',
          message: `${petName} — ${title} is due ${when}.`,
          vaccineLabel: title,
        });
      }
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const a of alerts) {
    const k = `${a.severity}|${a.message}`;
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    deduped.push(a);
    if (deduped.length >= 5) {
      break;
    }
  }
  return deduped;
}

function pickBanner(petId) {
  const hex = String(petId || '');
  const n = hex.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  if (n % 2 === 0) {
    return {
      eyebrow: "GIVE 'EM BETTER",
      headline: 'FREE HEALTH CHECKUP!',
      ctaLabel: 'Book Now',
      variant: 'health',
    };
  }
  return {
    eyebrow: 'PET ESSENTIALS',
    headline: 'Shop 20% Off',
    ctaLabel: 'Shop Now',
    variant: 'shop',
  };
}

function mapProduct(p) {
  const cat = p.category;
  let categoryName = '';
  if (cat && typeof cat === 'object') {
    categoryName = cat.name || '';
  }
  const img0 = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '';
  return {
    _id: p._id,
    name: p.name,
    price: p.price,
    image: img0,
    categoryName,
  };
}

const getHomeDashboard = asyncHandler(async (req, res) => {
  const { petId } = req.params;
  if (!petId || !mongoose.Types.ObjectId.isValid(petId)) {
    res.status(400);
    throw new Error('Invalid pet id');
  }

  const pet = await Pet.findOne({ _id: petId, owner: req.user._id }).lean();
  if (!pet) {
    res.status(404);
    throw new Error('Pet not found');
  }

  const user = await User.findById(req.user._id).select('name email profilePicture').lean();

  const speciesKey = (pet.species || 'other').toLowerCase();
  const enumVal = SPECIES_TO_TARGET[speciesKey] || 'OTHER';

  const productMatch = {
    $and: [
      { isAvailable: true },
      { stockQuantity: { $gt: 0 } },
      {
        $or: [
          { targetPets: { $exists: false } },
          { targetPets: { $size: 0 } },
          { targetPets: enumVal },
        ],
      },
    ],
  };

  const products = await Product.find(productMatch)
    .populate('category', 'name')
    .sort({ rating: -1, createdAt: -1 })
    .limit(12)
    .lean();

  let recommendedProducts = products.map(mapProduct);
  if (recommendedProducts.length === 0) {
    const fallback = await Product.find({ isAvailable: true, stockQuantity: { $gt: 0 } })
      .populate('category', 'name')
      .sort({ rating: -1, createdAt: -1 })
      .limit(12)
      .lean();
    recommendedProducts = fallback.map(mapProduct);
  }

  const activeOrder = await Order.findOne({
    user: req.user._id,
    status: { $in: ['processing', 'out_for_delivery'] },
  })
    .sort({ updatedAt: -1 })
    .populate('assignedRider', 'name profilePicture')
    .lean();

  const riderPins = await LiveLocation.find({ category: 'sim_rider', status: 'active' })
    .select('name lat lng key')
    .limit(24)
    .lean();

  let mapCenter = { lat: 27.7172, lng: 85.324 };
  if (activeOrder) {
    if (activeOrder.deliveryCoordinates?.lat != null && activeOrder.deliveryCoordinates?.lng != null) {
      mapCenter = {
        lat: activeOrder.deliveryCoordinates.lat,
        lng: activeOrder.deliveryCoordinates.lng,
      };
    } else if (activeOrder.deliveryLocation?.point?.coordinates?.length === 2) {
      const [lng, lat] = activeOrder.deliveryLocation.point.coordinates;
      mapCenter = { lat, lng };
    } else if (activeOrder.location?.lat != null && activeOrder.location?.lng != null) {
      mapCenter = { lat: activeOrder.location.lat, lng: activeOrder.location.lng };
    }
  }

  const pins = riderPins.map((pin) => ({
    key: pin.key,
    name: pin.name,
    lat: pin.lat,
    lng: pin.lng,
  }));

  const liveDelivery =
    activeOrder != null
      ? {
          orderId: activeOrder._id,
          status: activeOrder.status,
          assignmentStatus: activeOrder.assignmentStatus || null,
          rider: activeOrder.assignedRider
            ? {
                name: activeOrder.assignedRider.name,
                profilePicture: activeOrder.assignedRider.profilePicture || null,
              }
            : null,
          mapCenter,
          pins,
        }
      : null;

  res.json({
    success: true,
    data: {
      user: {
        name: user?.name || '',
        profilePicture: user?.profilePicture || null,
      },
      pet: {
        _id: pet._id,
        name: pet.name,
        species: pet.species,
        photoUrl: pet.photoUrl || '',
        pawId: pet.pawId || null,
      },
      banner: pickBanner(petId),
      healthAlerts: buildHealthAlertsForPet(pet),
      recommendedProducts,
      liveDelivery,
    },
  });
});

module.exports = {
  getHomeDashboard,
};
