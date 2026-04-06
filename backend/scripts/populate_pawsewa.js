/**
 * Professional seed for pawsewa_chat: pets, care listings, shop, past cases, orders.
 *
 * Prerequisites: backend/.env with MONGO_URI + DB_NAME=pawsewa_chat
 *
 * Usage:
 *   node scripts/populate_pawsewa.js
 *   node scripts/populate_pawsewa.js --force   (re-run inserts for demo data; safe duplicates avoided by checks)
 *
 * After run, set in backend/.env (if Customer Care still errors):
 *   CUSTOMER_CARE_ADMIN_ID=697ca0d530a61a7f06e3d1ef
 *   npm run sync:customer-care-admin
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');

const User = require('../src/models/User');
const Pet = require('../src/models/Pet');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Case = require('../src/models/Case');
const ServiceRequest = require('../src/models/ServiceRequest');
const Hostel = require('../src/models/Hostel');
const Subscription = require('../src/models/Subscription');

const CARE_ADMIN_ID_STR = '697ca0d530a61a7f06e3d1ef';

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'DemoPawSewa#2026';

const OWNER_EMAIL = 'demo.owner@pawsewa.chat';
const SHOP_EMAIL = 'demo.shop@pawsewa.chat';
const CARE_EMAIL = 'demo.care@pawsewa.chat';
const VET_EMAIL = 'demo.vet@pawsewa.chat';

const IMG = {
  petFood: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&q=80',
  petTreat: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&q=80',
  meds: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80',
  toy: 'https://images.unsplash.com/photo-1535294435445-8f4c8e1b4b0e?w=800&q=80',
  leash: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&q=80',
  bed: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80',
  grooming: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=800&q=80',
  training: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80',
  boarding: 'https://images.unsplash.com/photo-1601758125946-6c4d7e5c3b0e?w=800&q=80',
};

function log(...a) {
  console.log('[populate_pawsewa]', ...a);
}

async function ensureCareAdmin() {
  const id = new mongoose.Types.ObjectId(CARE_ADMIN_ID_STR);
  let u = await User.findById(id);
  if (u) {
    if (u.role !== 'admin') {
      u.role = 'admin';
      await u.save();
      log('Updated existing user to admin for Customer Care id');
    }
    return u;
  }
  let email = 'customer-care@pawsewa.chat';
  if (await User.findOne({ email })) {
    email = `care-${CARE_ADMIN_ID_STR.slice(-6)}@pawsewa.chat`;
  }
  u = await User.create({
    _id: id,
    name: 'PawSewa Customer Care',
    email,
    password: process.env.MASTER_ADMIN_PASSWORD || 'AdminCare#2026',
    role: 'admin',
    isVerified: true,
    phone: '9800000001',
  });
  log('Created Customer Care admin', email, CARE_ADMIN_ID_STR);
  return u;
}

async function ensureUser(email, data) {
  let u = await User.findOne({ email });
  if (!u) {
    u = await User.create({ email, password: DEMO_PASSWORD, ...data });
    log('Created user', email, u.role);
  }
  return u;
}

async function ensureSubscription(providerId) {
  const existing = await Subscription.findOne({
    providerId,
    status: 'active',
    validUntil: { $gt: new Date() },
  });
  if (existing) return existing;
  const s = await Subscription.create({
    providerId,
    plan: 'premium',
    billingCycle: 'yearly',
    status: 'active',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    amountPaid: 15000,
  });
  log('Created premium subscription for care provider', String(providerId));
  return s;
}

async function ensureCategories() {
  const specs = [
    { name: 'Food', slug: 'food', image: IMG.petFood },
    { name: 'Medicine', slug: 'medicine', image: IMG.meds },
    { name: 'Accessories', slug: 'accessories', image: IMG.toy },
  ];
  const out = [];
  for (const s of specs) {
    let c = await Category.findOne({ slug: s.slug });
    if (!c) {
      c = await Category.create(s);
      log('Category', s.slug);
    }
    out.push(c);
  }
  return out;
}

async function ensureProducts(shopOwner, categories) {
  const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c._id]));
  const items = [
    { name: 'Royal Canin Medium Adult', description: 'Complete dry nutrition for medium breeds.', price: 4200, stock: 40, cat: 'food', images: [IMG.petFood], tags: ['dog'] },
    { name: 'Hills Science Diet Puppy', description: 'Vet-recommended puppy growth formula.', price: 5100, stock: 32, cat: 'food', images: [IMG.petFood], tags: ['dog'] },
    { name: 'Whiskas Ocean Fish', description: 'Balanced wet meals for adult cats.', price: 1800, stock: 60, cat: 'food', images: [IMG.petTreat], tags: ['cat'] },
    { name: 'Tick & Flea Spot-On', description: 'Monthly parasite protection.', price: 950, stock: 100, cat: 'medicine', images: [IMG.meds], tags: ['dog', 'cat'] },
    { name: 'Dewormer Tablets (Broad)', description: 'Broad-spectrum intestinal dewormer.', price: 350, stock: 200, cat: 'medicine', images: [IMG.meds], tags: ['dog', 'cat'] },
    { name: 'Joint Care Chews', description: 'Glucosamine supplement chews.', price: 2200, stock: 45, cat: 'medicine', images: [IMG.meds], tags: ['dog'] },
    { name: 'Reflective Harness Set', description: 'Adjustable harness + leash bundle.', price: 2800, stock: 25, cat: 'accessories', images: [IMG.leash], tags: ['dog'] },
    { name: 'Interactive Puzzle Feeder', description: 'Mental enrichment slow feeder.', price: 1650, stock: 30, cat: 'accessories', images: [IMG.toy], tags: ['dog', 'cat'] },
    { name: 'Orthopedic Pet Bed (M)', description: 'Memory foam bed with washable cover.', price: 6500, stock: 15, cat: 'accessories', images: [IMG.bed], tags: ['dog', 'cat'] },
    { name: 'Grooming Slicker Brush', description: 'Professional deshedding brush.', price: 890, stock: 50, cat: 'accessories', images: [IMG.grooming], tags: ['dog', 'cat'] },
  ];

  const created = [];
  for (const it of items) {
    const exists = await Product.findOne({ name: it.name });
    if (exists) {
      created.push(exists);
      continue;
    }
    const targetMap = { dog: 'DOG', cat: 'CAT', rabbit: 'RABBIT' };
    const p = await Product.create({
      name: it.name,
      description: it.description,
      price: it.price,
      stockQuantity: it.stock,
      category: bySlug[it.cat],
      seller: shopOwner._id,
      vendorId: shopOwner._id,
      images: it.images,
      isAvailable: true,
      petTypes: it.tags,
      targetPets: it.tags.map((t) => targetMap[t] || 'DOG'),
    });
    created.push(p);
    log('Product', it.name);
  }
  return created;
}

async function ensurePets(owner) {
  const specs = [
    { name: 'Spoidy', species: 'Dog', breed: 'Indie mix', gender: 'Male', age: 3, photoUrl: IMG.training },
    { name: 'Buddy', species: 'Dog', breed: 'Golden Retriever', gender: 'Male', age: 5, photoUrl: IMG.petFood },
    { name: 'Luna', species: 'Cat', breed: 'Persian', gender: 'Female', age: 2, photoUrl: IMG.petTreat },
    { name: 'Milo', species: 'Rabbit', breed: 'Holland Lop', gender: 'Male', age: 1, photoUrl: IMG.toy },
    { name: 'Coco', species: 'Dog', breed: 'Beagle', gender: 'Female', age: 4, photoUrl: IMG.bed },
  ];
  const pets = [];
  for (const s of specs) {
    let p = await Pet.findOne({ owner: owner._id, name: s.name });
    if (!p) {
      p = await Pet.create({
        owner: owner._id,
        name: s.name,
        species: s.species,
        breed: s.breed,
        gender: s.gender,
        age: s.age,
        photoUrl: s.photoUrl,
        isVaccinated: true,
      });
      await p.save();
      log('Pet', s.name);
    }
    pets.push(p);
  }
  return pets;
}

async function ensureHostels(careOwner) {
  await ensureSubscription(careOwner._id);

  const listings = [
    {
      name: 'PawSewa Grooming Lounge — Thamel',
      serviceType: 'Grooming',
      description: 'Full-service grooming: bath, blow-dry, nail trim, breed-specific styling. Certified groomers.',
      pricePerSession: 1200,
      images: [IMG.grooming],
      lat: 27.7172,
      lng: 85.324,
    },
    {
      name: 'Fluffy Tails Spa & Grooming',
      serviceType: 'Grooming',
      description: 'Spa packages, de-shedding treatments, and gentle handling for anxious pets.',
      pricePerSession: 1500,
      images: [IMG.grooming],
      lat: 27.671,
      lng: 85.324,
    },
    {
      name: 'K9 Academy Nepal — Obedience',
      serviceType: 'Training',
      description: 'Positive-reinforcement training: puppy basics, leash manners, and recall.',
      pricePerSession: 2000,
      images: [IMG.training],
      lat: 27.7212,
      lng: 85.3614,
    },
    {
      name: 'Valley Care Centre — Boarding',
      serviceType: 'Hostel',
      description: 'Climate-controlled suites, supervised play, and nightly wellness checks. Your pet’s home away from home.',
      pricePerNight: 1800,
      images: [IMG.boarding],
      lat: 27.6789,
      lng: 85.3456,
    },
  ];

  let n = 0;
  for (const L of listings) {
    const exists = await Hostel.findOne({ name: L.name });
    if (exists) continue;
    const perNight = L.pricePerNight != null ? L.pricePerNight : L.pricePerSession || 0;
    await Hostel.create({
      ownerId: careOwner._id,
      name: L.name,
      description: L.description,
      location: {
        address: 'Kathmandu Valley, Nepal',
        coordinates: { lat: L.lat, lng: L.lng },
      },
      pricePerNight: perNight,
      pricePerSession: L.pricePerSession != null ? L.pricePerSession : undefined,
      images: L.images,
      amenities: ['WiFi', 'Vet on call', 'Daily updates'],
      rating: 4.7,
      reviewCount: 24,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: L.serviceType,
      groomingPackages:
        L.serviceType === 'Grooming'
          ? [
              { name: 'Essential Clean', price: 900, description: 'Bath & dry', durationMinutes: 45 },
              { name: 'Full Groom', price: L.pricePerSession, description: 'Cut, nails, ears', durationMinutes: 90 },
            ]
          : [],
    });
    n += 1;
  }
  if (n) log('Hostels / care centres inserted:', n);
  else log('Hostels already present, skipped duplicates');
}

async function ensureCases(owner, pets, vet) {
  const target = 5;
  const have = await Case.countDocuments({ customer: owner._id });
  if (have >= target) {
    log('Cases for demo owner already >=', target);
    return;
  }
  const statuses = ['completed', 'completed', 'completed', 'cancelled', 'cancelled'];
  const issues = [
    '[SEED] Evening limp after walk — resolved with rest.',
    '[SEED] Mild cough — tele-triage completed.',
    '[SEED] Vaccination record review.',
    '[SEED] Owner cancelled — travel conflict.',
    '[SEED] Duplicate request — cancelled.',
  ];
  for (let i = 0; i < target; i += 1) {
    const pet = pets[i % pets.length];
    const st = statuses[i];
    const created = await Case.create({
      customer: owner._id,
      pet: pet._id,
      issueDescription: issues[i],
      location: 'Lazimpat, Kathmandu',
      latitude: 27.73,
      longitude: 85.32,
      status: st,
      assignedVet: st === 'completed' ? vet._id : null,
      assignedAt: st === 'completed' ? new Date(Date.now() - (i + 3) * 86400000) : undefined,
      completedAt: st === 'completed' ? new Date(Date.now() - (i + 1) * 86400000) : undefined,
    });
    log('Case', created._id, st);
  }
}

async function ensureServiceRequests(owner, pets, vet) {
  const target = 5;
  const have = await ServiceRequest.countDocuments({ user: owner._id });
  if (have >= target) {
    log('Service requests for demo owner already >=', target);
    return;
  }
  const types = ['Appointment', 'Health Checkup', 'Vaccination', 'Appointment', 'Health Checkup'];
  const statuses = ['completed', 'completed', 'completed', 'cancelled', 'cancelled'];
  for (let i = 0; i < target; i += 1) {
    const pet = pets[i % pets.length];
    const st = statuses[i];
    const day = new Date();
    day.setDate(day.getDate() - 14 - i);
    await ServiceRequest.create({
      user: owner._id,
      pet: pet._id,
      petPawId: pet.pawId || '',
      serviceType: types[i],
      preferredDate: day,
      timeWindow: 'Morning (9am-12pm)',
      location: {
        address: 'Baneshwor, Kathmandu',
        coordinates: { lat: 27.705, lng: 85.333 },
      },
      status: st,
      assignedStaff: st === 'completed' ? vet._id : null,
      assignedAt: st === 'completed' ? new Date(day.getTime() + 3600000) : undefined,
      completedAt: st === 'completed' ? new Date(day.getTime() + 7200000) : undefined,
      cancelledAt: st === 'cancelled' ? new Date() : undefined,
      notes: '[SEED] Demo service request',
    });
    log('ServiceRequest', types[i], st);
  }
}

async function ensureOrders(owner, products) {
  const target = 5;
  const have = await Order.countDocuments({ user: owner._id });
  if (have >= target) {
    log('Orders for demo owner already >=', target);
    return;
  }
  const ktm = { lng: 85.324, lat: 27.7172 };
  for (let i = 0; i < target; i += 1) {
    const p = products[i % products.length];
    const qty = 1 + (i % 2);
    const total = Math.round(p.price * qty);
    await Order.create({
      user: owner._id,
      items: [
        {
          product: p._id,
          name: p.name,
          price: p.price,
          quantity: qty,
        },
      ],
      totalAmount: total,
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      deliveryLocation: {
        address: 'Demo delivery — Jhamsikhel, Lalitpur',
        point: {
          type: 'Point',
          coordinates: [ktm.lng + i * 0.002, ktm.lat + i * 0.001],
        },
      },
      status: 'delivered',
    });
    log('Order delivered', i + 1);
  }
}

async function main() {
  const uri = getConnectionUri();
  await mongoose.connect(uri, getMongooseConnectionOptions(uri));
  log('Connected', mongoose.connection.name);

  await ensureCareAdmin();

  const owner = await ensureUser(OWNER_EMAIL, {
    name: 'Alex Thapa',
    role: 'pet_owner',
    isVerified: true,
    phone: '9801234567',
  });
  const shopOwner = await ensureUser(SHOP_EMAIL, {
    name: 'PawSewa Demo Shop',
    role: 'shop_owner',
    isVerified: true,
    phone: '9807654321',
  });
  const careOwner = await ensureUser(CARE_EMAIL, {
    name: 'Valley Care Providers',
    role: 'care_service',
    isVerified: true,
    phone: '9801112233',
  });
  const vet = await ensureUser(VET_EMAIL, {
    name: 'Dr. Samira Gurung',
    role: 'veterinarian',
    isVerified: true,
    phone: '9804445566',
    clinicName: 'Thamel Vet Clinic',
    clinicLocation: 'Kathmandu',
    specialty: 'Small animal',
  });

  const categories = await ensureCategories();
  const products = await ensureProducts(shopOwner, categories);
  const pets = await ensurePets(owner);

  await ensureHostels(careOwner);
  await ensureCases(owner, pets, vet);
  await ensureServiceRequests(owner, pets, vet);
  await ensureOrders(owner, products);

  log('Done. Set CUSTOMER_CARE_ADMIN_ID=', CARE_ADMIN_ID_STR, 'in .env for Customer Care.');
  log('Demo login:', OWNER_EMAIL, '/', DEMO_PASSWORD);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error('[populate_pawsewa] FATAL', e);
  process.exit(1);
});
