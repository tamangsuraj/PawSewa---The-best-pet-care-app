/**
 * Pilot seed for pawsewa_chat: pets (Spoidy + 2), care listings with active subscriptions,
 * shop catalog (10 products), and veterinarian profiles.
 *
 * Requires: backend/.env with MONGO_URI + DB_NAME (e.g. pawsewa_chat).
 *
 * Env:
 *   SEED_PET_OWNER_EMAIL  — pet_owner to attach pets to (default: first pet_owner in DB)
 *   SEED_DEFAULT_PASSWORD — plaintext for new seed users (default: PilotSeed#2026)
 *
 * Run: npm run seed:data
 */
/* eslint-disable no-console */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');

const User = require('../src/models/User');
const Pet = require('../src/models/Pet');
const Hostel = require('../src/models/Hostel');
const Subscription = require('../src/models/Subscription');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

const IMG = (photoPath) =>
  `https://images.unsplash.com/${photoPath}?auto=format&fit=crop&q=85&w=1200`;

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'PilotSeed#2026';

const KTM = { lat: 27.7172, lng: 85.324 };

function log(...args) {
  console.log('[seed-data]', ...args);
}

async function ensureCategory(slug, name, image) {
  let c = await Category.findOne({ slug });
  if (c) return c;
  c = await Category.create({ slug, name, image: image || '' });
  log('Category created:', slug);
  return c;
}

async function ensureUser({ email, name, role, extra = {} }) {
  const em = email.toLowerCase().trim();
  let u = await User.findOne({ email: em });
  if (u) {
    let dirty = false;
    if (u.role !== role) {
      u.role = role;
      dirty = true;
    }
    if (extra.name && u.name !== extra.name) {
      u.name = extra.name;
      dirty = true;
    }
    Object.assign(u, extra);
    if (dirty || Object.keys(extra).length) {
      await u.save();
    }
    return u;
  }
  u = await User.create({
    name,
    email: em,
    password: DEFAULT_PASSWORD,
    role,
    isVerified: true,
    phone: extra.phone || '9800000000',
    ...extra,
  });
  log('User created:', em, role);
  return u;
}

async function ensureActiveSubscription(providerId) {
  const now = new Date();
  const until = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const existing = await Subscription.findOne({
    providerId,
    status: 'active',
    validUntil: { $gt: now },
  });
  if (existing) return existing;
  const sub = await Subscription.create({
    providerId,
    plan: 'premium',
    billingCycle: 'yearly',
    status: 'active',
    validFrom: now,
    validUntil: until,
    amountPaid: 15000,
    gatewayTransactionId: 'seed-data',
  });
  log('Subscription created for provider', String(providerId));
  return sub;
}

async function upsertHostel(query, payload) {
  const filter = { ...query };
  const doc = await Hostel.findOneAndUpdate(
    filter,
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  log('Hostel upserted:', doc.name, doc.serviceType);
  return doc;
}

function petTypesFromTarget(targetPets) {
  if (!Array.isArray(targetPets) || targetPets.length === 0) return [];
  const out = [];
  if (targetPets.includes('DOG')) out.push('dog');
  if (targetPets.includes('CAT')) out.push('cat');
  if (targetPets.includes('RABBIT')) out.push('rabbit');
  return out;
}

async function resolvePetOwner() {
  const envEmail = process.env.SEED_PET_OWNER_EMAIL;
  if (envEmail && String(envEmail).trim()) {
    const u = await User.findOne({ email: String(envEmail).toLowerCase().trim() });
    if (!u) {
      throw new Error(`SEED_PET_OWNER_EMAIL=${envEmail} not found. Create the user or omit env to use first pet_owner.`);
    }
    return u;
  }
  const first = await User.findOne({ role: 'pet_owner' }).sort({ createdAt: 1 });
  if (!first) {
    throw new Error('No pet_owner user in database. Register a customer first or set SEED_PET_OWNER_EMAIL.');
  }
  log('Using first pet_owner:', first.email);
  return first;
}

async function seedPets(ownerId) {
  const defs = [
    {
      name: 'Spoidy',
      species: 'Dog',
      breed: 'Golden Retriever',
      gender: 'Male',
      age: 3,
      weight: 28,
      photoUrl: IMG('photo-1552053831-71594a27632d'),
      medicalConditions: '',
    },
    {
      name: 'Luna',
      species: 'Cat',
      breed: 'British Shorthair',
      gender: 'Female',
      age: 2,
      weight: 4.5,
      photoUrl: IMG('photo-1514888286974-6c03e2ca1dba'),
      medicalConditions: '',
    },
    {
      name: 'Coco',
      species: 'Rabbit',
      breed: 'Holland Lop',
      gender: 'Female',
      age: 1,
      weight: 1.2,
      photoUrl: IMG('photo-1585110396000-c9ffd4e4b308'),
      medicalConditions: '',
    },
  ];

  for (const d of defs) {
    const existing = await Pet.findOne({ owner: ownerId, name: d.name });
    if (existing) {
      existing.breed = d.breed;
      existing.species = d.species;
      existing.gender = d.gender;
      existing.age = d.age;
      existing.weight = d.weight;
      existing.photoUrl = d.photoUrl;
      await existing.save();
      log('Pet updated:', d.name);
    } else {
      await Pet.create({ owner: ownerId, ...d, isVaccinated: true });
      log('Pet created:', d.name);
    }
  }
}

async function seedCareCenters() {
  const p1 = await ensureUser({
    email: 'seed.spa.groomer@pawsewa.local',
    name: 'Premium Spa Partner',
    role: 'groomer',
    extra: { facilityName: 'Premium Grooming Spa' },
  });
  const p2 = await ensureUser({
    email: 'seed.k9.trainer@pawsewa.local',
    name: 'K9 Training Partner',
    role: 'trainer',
    extra: { facilityName: 'Expert K9 Training' },
  });
  const p3 = await ensureUser({
    email: 'seed.luxury.hostel@pawsewa.local',
    name: 'Luxury Stay Partner',
    role: 'hostel_owner',
    extra: { facilityName: 'Luxury Pet Stay' },
  });
  const p4 = await ensureUser({
    email: 'seed.deworm.wash@pawsewa.local',
    name: 'Clinical Wash Partner',
    role: 'service_provider',
    extra: { facilityName: 'Professional Deworming Service' },
  });
  const p5 = await ensureUser({
    email: 'seed.royal.spa@pawsewa.local',
    name: 'Royal Spa Partner',
    role: 'groomer',
    extra: { facilityName: 'Royal Paw Spa Retreat' },
  });

  for (const p of [p1, p2, p3, p4, p5]) {
    await ensureActiveSubscription(p._id);
  }

  await upsertHostel(
    { name: 'Premium Grooming Spa' },
    {
      ownerId: p1._id,
      name: 'Premium Grooming Spa',
      description:
        'Full-service grooming with breed-specific coat care, nail spa, and calming aromatherapy. Packages designed for show-ready finishes.',
      location: {
        address: 'Lazimpat, Kathmandu',
        coordinates: { ...KTM },
      },
      pricePerNight: 0,
      pricePerSession: 2200,
      images: [
        IMG('photo-1516734212186-a967d32f9e88'),
        IMG('photo-1583337130417-334622a1fd0a'),
      ],
      amenities: ['Hydro bath', 'Breed cuts', 'Spa packages', 'Certified groomers'],
      rating: 4.9,
      reviewCount: 128,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Grooming',
      groomingPackages: [
        { name: 'Essential Clean', price: 1200, description: 'Bath, blow-dry, nails', durationMinutes: 45 },
        { name: 'Full Spa', price: 2200, description: 'Deep coat treatment + massage', durationMinutes: 90 },
      ],
      addOns: [
        { name: 'Tick & flea rinse', price: 350 },
        { name: 'Teeth brushing', price: 250 },
      ],
      staff: [{ name: 'Anita M.', experienceYears: 8, photoUrl: IMG('photo-1494790108377-be9c29b29330') }],
    }
  );

  await upsertHostel(
    { name: 'Expert K9 Training' },
    {
      ownerId: p2._id,
      name: 'Expert K9 Training',
      description:
        'Positive-reinforcement obedience, leash manners, and agility foundations. Certified trainers for all energy levels.',
      location: {
        address: 'Patan, Lalitpur',
        coordinates: { lat: 27.6761, lng: 85.324 },
      },
      pricePerNight: 0,
      pricePerSession: 1800,
      images: [IMG('photo-1587300003388-59208cc962cb'), IMG('photo-1548199973-03cce0bbc87b')],
      amenities: ['Indoor arena', 'Outdoor run', '1:1 sessions'],
      rating: 4.85,
      reviewCount: 94,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Training',
      schedule: [
        { time: '07:00', activity: 'Morning socialization' },
        { time: '16:00', activity: 'Obedience group' },
      ],
    }
  );

  await upsertHostel(
    { name: 'Luxury Pet Stay (Hostel)' },
    {
      ownerId: p3._id,
      name: 'Luxury Pet Stay (Hostel)',
      description:
        'Climate-controlled suites, twice-daily walks, and on-call vet support. Ideal for extended travel.',
      location: {
        address: 'Budhanilkantha, Kathmandu',
        coordinates: { lat: 27.775, lng: 85.3667 },
      },
      pricePerNight: 1850,
      images: [IMG('photo-1601758224634-281c0353bd1b'), IMG('photo-1450778869180-41d0601e046e')],
      amenities: ['24/7 staff', 'Webcam check-ins', 'Premium bedding', 'Play yards'],
      roomTypes: [
        { name: 'Standard Suite', pricePerNight: 1850, description: 'Indoor run + 3 walks' },
        { name: 'VIP Suite', pricePerNight: 2650, description: 'Private patio + extra play' },
      ],
      rating: 4.92,
      reviewCount: 210,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Hostel',
    }
  );

  await upsertHostel(
    { name: 'Professional Deworming Service' },
    {
      ownerId: p4._id,
      name: 'Professional Deworming Service',
      description:
        'Vet-supervised parasite protocols, medicated baths, and follow-up schedules. Safe for puppies and seniors.',
      location: {
        address: 'Koteshwor, Kathmandu',
        coordinates: { lat: 27.6789, lng: 85.3456 },
      },
      pricePerNight: 0,
      pricePerSession: 950,
      images: [IMG('photo-1628009368231-7bb7cfcb0def'), IMG('photo-1583511655852-d00b3a7a4b62')],
      amenities: ['Parasite screening', 'Medicated rinse', 'Digital health report'],
      rating: 4.75,
      reviewCount: 67,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Wash',
    }
  );

  await upsertHostel(
    { name: 'Royal Paw Spa Retreat' },
    {
      ownerId: p5._id,
      name: 'Royal Paw Spa Retreat',
      description:
        'Thermal soak, coat masque, and gentle massage. Perfect recovery day after travel or shedding season.',
      location: {
        address: 'Jhamsikhel, Lalitpur',
        coordinates: { lat: 27.671, lng: 85.312 },
      },
      pricePerNight: 0,
      pricePerSession: 1950,
      images: [IMG('photo-1530281700549-e82e7bf096d6'), IMG('photo-1546527868-ccb7ee7dfa6a')],
      amenities: ['Aromatherapy', 'Coat masque', 'Quiet suites'],
      rating: 4.88,
      reviewCount: 96,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Spa',
      groomingPackages: [
        { name: 'Renewal Soak', price: 1450, description: 'Mineral bath + brush-out', durationMinutes: 60 },
        { name: 'Royal Full Day', price: 1950, description: 'Soak, masque, paw treatment', durationMinutes: 120 },
      ],
    }
  );
}

async function seedShop() {
  const catFood = await ensureCategory('pet-food', 'Pet Food', IMG('photo-1589924691995-400dc9ecc119'));
  const catMeds = await ensureCategory('medicines', 'Medicines', IMG('photo-1587854692152-cbe660dbde88'));
  const catAcc = await ensureCategory('accessories', 'Accessories', IMG('photo-1545249390-6bdfa286032f'));
  const catGroom = await ensureCategory('grooming-kits', 'Grooming Kits', IMG('photo-1516734212186-a967d32f9e88'));

  const seller = await ensureUser({
    email: 'seed.shop@pawsewa.local',
    name: 'PawSewa Pilot Shop',
    role: 'shop_owner',
    extra: { shopName: 'PawSewa Pilot Shop', facilityName: 'PawSewa Pilot Shop' },
  });

  const rows = [
    {
      name: 'Salmon & Sweet Potato Adult Dog Food',
      description: 'High-protein kibble with omega blend for coat and joint support.',
      price: 2890,
      stockQuantity: 80,
      categoryId: catFood._id,
      targetPets: ['DOG'],
      images: [IMG('photo-1589924691995-400dc9ecc119')],
      tags: ['Food', 'DOG'],
      badge: 'NATURAL',
    },
    {
      name: 'Grain-Free Chicken Kitten Formula',
      description: 'DHA-rich recipe for kittens up to 12 months.',
      price: 2650,
      stockQuantity: 65,
      categoryId: catFood._id,
      targetPets: ['CAT'],
      images: [IMG('photo-1514888286974-6c03e2ca1dba')],
      tags: ['Kitten', 'CAT'],
      badge: 'GROWTH',
    },
    {
      name: 'Rabbit Timothy Hay Pellets',
      description: 'Fiber-forward daily nutrition for small herbivores.',
      price: 890,
      stockQuantity: 120,
      categoryId: catFood._id,
      targetPets: ['RABBIT'],
      images: [IMG('photo-1585110396000-c9ffd4e4b308')],
      tags: ['Hay', 'RABBIT'],
    },
    {
      name: 'Broad-Spectrum Dewormer Chews (Dog)',
      description: 'Follow your veterinarian’s dosing chart. Beef-flavored chewables.',
      price: 1450,
      stockQuantity: 40,
      categoryId: catMeds._id,
      targetPets: ['DOG'],
      images: [IMG('photo-1587854692152-cbe660dbde88')],
      tags: ['Rx-grade', 'Parasite'],
      badge: 'HEALTH',
    },
    {
      name: 'Flea & Tick Spot-On (Cat)',
      description: 'Monthly topical protection; consult your vet for weight band.',
      price: 1320,
      stockQuantity: 55,
      categoryId: catMeds._id,
      targetPets: ['CAT'],
      images: [IMG('photo-1450778869180-41d0601e046e')],
      tags: ['Parasite', 'CAT'],
    },
    {
      name: 'Adjustable Reflective Harness',
      description: 'Padded chest plate, four-point adjustment, night-reflective trim.',
      price: 1890,
      stockQuantity: 95,
      categoryId: catAcc._id,
      targetPets: ['DOG'],
      images: [IMG('photo-1601758224634-281c0353bd1b')],
      tags: ['Walk', 'Safety'],
    },
    {
      name: 'Travel Carrier (Airline-Ready)',
      description: 'Ventilated hard-shell carrier with secure latch — cabin size.',
      price: 5200,
      stockQuantity: 28,
      categoryId: catAcc._id,
      targetPets: ['CAT', 'DOG'],
      images: [IMG('photo-1548199973-03cce0bbc87b')],
      tags: ['Travel', 'CAT', 'DOG'],
    },
    {
      name: 'Ceramic Slow-Feed Bowl',
      description: 'Maze pattern reduces gulp eating; dishwasher safe.',
      price: 1450,
      stockQuantity: 70,
      categoryId: catAcc._id,
      targetPets: ['DOG', 'CAT'],
      images: [IMG('photo-1560743178-567de3b53c4f')],
      tags: ['Feeding'],
    },
    {
      name: 'Pro Grooming Kit — Shedding Control',
      description: 'Undercoat rake, slicker, comb, and nail clippers in carry case.',
      price: 2490,
      stockQuantity: 45,
      categoryId: catGroom._id,
      targetPets: ['DOG', 'CAT'],
      images: [IMG('photo-1516734212186-a967d32f9e88')],
      tags: ['Grooming', 'Shedding'],
      badge: 'CARE',
    },
    {
      name: 'Spa Wash & Dry Starter Pack',
      description: 'Hypoallergenic shampoo, conditioner, microfiber towels, and dryer glove.',
      price: 2180,
      stockQuantity: 38,
      categoryId: catGroom._id,
      targetPets: ['DOG', 'CAT'],
      images: [IMG('photo-1583337130417-334622a1fd0a')],
      tags: ['Bath', 'Home spa'],
    },
  ];

  for (const r of rows) {
    const petTypes = petTypesFromTarget(r.targetPets);
    let p = await Product.findOne({ name: r.name, seller: seller._id });
    const doc = {
      name: r.name,
      description: r.description,
      price: r.price,
      stockQuantity: r.stockQuantity,
      category: r.categoryId,
      seller: seller._id,
      vendorId: seller._id,
      images: r.images,
      isAvailable: true,
      rating: 4.5 + Math.random() * 0.45,
      reviewCount: Math.floor(20 + Math.random() * 180),
      petTypes,
      targetPets: r.targetPets,
      tags: r.tags,
      badge: r.badge || '',
    };
    if (p) {
      Object.assign(p, doc);
      await p.save();
      log('Product updated:', r.name);
    } else {
      p = await Product.create(doc);
      log('Product created:', r.name);
    }
  }
}

async function seedVets() {
  const vets = [
    {
      email: 'dr.sarah.malla@pawsewa.local',
      name: 'Dr. Sarah Malla',
      specialization: 'Small animal internal medicine',
      specialty: 'Dogs & cats — chronic disease management',
      clinicName: 'Valley Animal Clinic',
      clinicAddress: 'Maharajgunj, Kathmandu',
      clinicLocation: 'Maharajgunj',
      bio: '15+ years in small animal practice. Focus on diagnostics, nutrition, and senior pet care.',
      profilePicture: IMG('photo-1559839734-2b71ea197ec2'),
      workingHours: {
        open: '09:00',
        close: '18:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
      isProfileComplete: true,
    },
    {
      email: 'dr.raj.thapa@pawsewa.local',
      name: 'Dr. Raj Thapa',
      specialization: 'Orthopedics & surgery',
      specialty: 'Soft-tissue surgery, fracture care',
      clinicName: 'Thapa Veterinary Surgical Centre',
      clinicAddress: 'Pulchowk, Lalitpur',
      clinicLocation: 'Pulchowk',
      bio: 'Board-focused surgeon with emphasis on trauma recovery and post-op rehab planning.',
      profilePicture: IMG('photo-1612349317150-e413f6a5b16d'),
      workingHours: {
        open: '10:00',
        close: '19:00',
        days: ['Mon', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
      isProfileComplete: true,
    },
    {
      email: 'dr.priya.shrestha@pawsewa.local',
      name: 'Dr. Priya Shrestha',
      specialization: 'Dermatology & allergies',
      specialty: 'Skin, ear, and allergy workups',
      clinicName: 'PawDerm Specialist Clinic',
      clinicAddress: 'Jhamsikhel, Lalitpur',
      clinicLocation: 'Jhamsikhel',
      bio: 'Allergy testing, chronic itch protocols, and breed-specific coat programs.',
      profilePicture: IMG('photo-1594824476967-48c8b964273f'),
      workingHours: {
        open: '09:30',
        close: '17:30',
        days: ['Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      },
      isProfileComplete: true,
    },
  ];

  for (const v of vets) {
    await ensureUser({
      email: v.email,
      name: v.name,
      role: 'veterinarian',
      extra: {
        specialization: v.specialization,
        specialty: v.specialty,
        clinicName: v.clinicName,
        clinicAddress: v.clinicAddress,
        clinicLocation: v.clinicLocation,
        bio: v.bio,
        profilePicture: v.profilePicture,
        workingHours: v.workingHours,
        isProfileComplete: v.isProfileComplete,
        isVerified: true,
      },
    });
  }
}

async function run() {
  const uri = getConnectionUri();
  await mongoose.connect(uri, getMongooseConnectionOptions(uri));
  const dbName = mongoose.connection.db?.databaseName || 'unknown';
  log('Connected to', dbName);

  const owner = await resolvePetOwner();
  await seedPets(owner._id);
  await seedCareCenters();
  await seedShop();
  await seedVets();

  log('Done. Pets →', owner.email);
  log('Log in seed providers with password:', DEFAULT_PASSWORD);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error('[seed-data] FAILED:', e.message || e);
  mongoose.disconnect().finally(() => process.exit(1));
});
