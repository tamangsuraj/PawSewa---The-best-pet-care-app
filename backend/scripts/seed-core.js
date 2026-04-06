/**
 * Seed pawsewa_core with a clean, linked baseline so UIs are not empty.
 *
 * Creates:
 * - 1 admin (CUSTOMER_CARE_ADMIN_ID)
 * - 2 vets
 * - 2 customers + 5 pets (includes Spoidy)
 * - 1 shop_owner + 10 products
 * - 4 care centres (Grooming/Training) + active subscriptions
 *
 * Run: npm run seed:core
 */
/* eslint-disable no-console */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');

const User = require('../src/models/User');
const Pet = require('../src/models/Pet');
const Subscription = require('../src/models/Subscription');
const Hostel = require('../src/models/Hostel');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

const IMG = (photoPath) =>
  `https://images.unsplash.com/${photoPath}?auto=format&fit=crop&q=85&w=1200`;

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'CoreSeed#2026';

const CARE_ADMIN_ID = (process.env.CUSTOMER_CARE_ADMIN_ID || '').trim();

function log(...args) {
  console.log('[seed-core]', ...args);
}

async function ensureUser({ _id, email, name, role, extra = {} }) {
  const em = email.toLowerCase().trim();
  let u = await User.findOne({ email: em });
  if (u) {
    Object.assign(u, { name, role, ...extra });
    if (_id && String(u._id) !== String(_id)) {
      log('NOTE: existing user email matched but has different _id:', em);
    }
    await u.save();
    return u;
  }
  u = await User.create({
    ...( _id ? { _id } : null),
    name,
    email: em,
    password: DEFAULT_PASSWORD,
    role,
    isVerified: true,
    phone: extra.phone || '9800000000',
    ...extra,
  });
  return u;
}

async function ensureCategory(slug, name) {
  let c = await Category.findOne({ slug });
  if (c) return c;
  c = await Category.create({ slug, name, image: '' });
  return c;
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
  return Subscription.create({
    providerId,
    plan: 'premium',
    billingCycle: 'yearly',
    status: 'active',
    validFrom: now,
    validUntil: until,
    amountPaid: 15000,
    gatewayTransactionId: 'seed-core',
  });
}

async function upsertHostelByName(name, payload) {
  const doc = await Hostel.findOneAndUpdate(
    { name },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc;
}

async function upsertProductByNameSeller(name, sellerId, payload) {
  const doc = await Product.findOneAndUpdate(
    { name, seller: sellerId },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc;
}

async function upsertPet(ownerId, def) {
  const filter = { owner: ownerId, name: def.name };
  const existing = await Pet.findOne(filter);
  if (existing) {
    Object.assign(existing, def);
    await existing.save();
    return existing;
  }
  return Pet.create({ owner: ownerId, ...def, isVaccinated: true });
}

async function run() {
  const uri = getConnectionUri();
  await mongoose.connect(uri, getMongooseConnectionOptions(uri));
  log('Connected db=', mongoose.connection.db?.databaseName);

  if (!CARE_ADMIN_ID || !mongoose.Types.ObjectId.isValid(CARE_ADMIN_ID)) {
    throw new Error('Set CUSTOMER_CARE_ADMIN_ID (valid ObjectId) in backend/.env before seeding.');
  }

  // Users
  const admin = await ensureUser({
    _id: new mongoose.Types.ObjectId(CARE_ADMIN_ID),
    email: 'customer-care@pawsewa.local',
    name: 'PawSewa Customer Care',
    role: 'admin',
    extra: { phone: '9800000001' },
  });

  const vet1 = await ensureUser({
    email: 'dr.sarah.malla@pawsewa.local',
    name: 'Dr. Sarah Malla',
    role: 'veterinarian',
    extra: {
      specialization: 'Small animal internal medicine',
      specialty: 'Dogs & cats — chronic disease management',
      clinicName: 'Valley Animal Clinic',
      clinicLocation: 'Kathmandu',
      profilePicture: IMG('photo-1559839734-2b71ea197ec2'),
      isProfileComplete: true,
    },
  });
  const vet2 = await ensureUser({
    email: 'dr.raj.thapa@pawsewa.local',
    name: 'Dr. Raj Thapa',
    role: 'veterinarian',
    extra: {
      specialization: 'Orthopedics & surgery',
      specialty: 'Soft-tissue surgery, fracture care',
      clinicName: 'Thapa Veterinary Surgical Centre',
      clinicLocation: 'Lalitpur',
      profilePicture: IMG('photo-1612349317150-e413f6a5b16d'),
      isProfileComplete: true,
    },
  });

  const cust1 = await ensureUser({
    email: 'seed.customer1@pawsewa.local',
    name: 'Anisha Shrestha',
    role: 'pet_owner',
    extra: { phone: '9801111000' },
  });
  const cust2 = await ensureUser({
    email: 'seed.customer2@pawsewa.local',
    name: 'Sujan Karki',
    role: 'pet_owner',
    extra: { phone: '9801112000' },
  });

  log('Users ready:', {
    admin: String(admin._id),
    vet1: String(vet1._id),
    vet2: String(vet2._id),
    cust1: String(cust1._id),
    cust2: String(cust2._id),
  });

  // Pets (5 total, linked across 2 customers)
  await upsertPet(cust1._id, {
    name: 'Spoidy',
    species: 'Dog',
    breed: 'Golden Retriever',
    gender: 'Male',
    age: 3,
    weight: 28,
    photoUrl: IMG('photo-1552053831-71594a27632d'),
    medicalConditions: '',
  });
  await upsertPet(cust1._id, {
    name: 'Luna',
    species: 'Cat',
    breed: 'British Shorthair',
    gender: 'Female',
    age: 2,
    weight: 4.5,
    photoUrl: IMG('photo-1514888286974-6c03e2ca1dba'),
    medicalConditions: '',
  });
  await upsertPet(cust1._id, {
    name: 'Buddy',
    species: 'Dog',
    breed: 'Beagle',
    gender: 'Male',
    age: 4,
    weight: 12,
    photoUrl: IMG('photo-1543466835-00a7907e9de1'),
    medicalConditions: '',
  });
  await upsertPet(cust2._id, {
    name: 'Milo',
    species: 'Cat',
    breed: 'Persian',
    gender: 'Male',
    age: 5,
    weight: 5.2,
    photoUrl: IMG('photo-1574158622682-e40e69881006'),
    medicalConditions: '',
  });
  await upsertPet(cust2._id, {
    name: 'Coco',
    species: 'Rabbit',
    breed: 'Holland Lop',
    gender: 'Female',
    age: 1,
    weight: 1.2,
    photoUrl: IMG('photo-1585110396000-c9ffd4e4b308'),
    medicalConditions: '',
  });
  log('Pets seeded: 5');

  // Care centres (4, Grooming/Training) + subscriptions
  const careOwner = await ensureUser({
    email: 'seed.care@pawsewa.local',
    name: 'Valley Care Providers',
    role: 'service_provider',
    extra: { facilityName: 'Valley Care Providers', phone: '9807777000' },
  });
  await ensureActiveSubscription(careOwner._id);

  const KTM = { lat: 27.7172, lng: 85.324 };
  const careDefs = [
    {
      name: 'PawSewa Grooming Lounge — Thamel',
      serviceType: 'Grooming',
      pricePerSession: 1200,
      images: [IMG('photo-1516734212186-a967f81ad0d7')],
      loc: { address: 'Thamel, Kathmandu', coordinates: { ...KTM } },
    },
    {
      name: 'Fluffy Tails Spa & Grooming',
      serviceType: 'Grooming',
      pricePerSession: 1500,
      images: [IMG('photo-1583337130417-334622a1fd0a')],
      loc: { address: 'Jhamsikhel, Lalitpur', coordinates: { lat: 27.671, lng: 85.312 } },
    },
    {
      name: 'K9 Academy Nepal — Obedience',
      serviceType: 'Training',
      pricePerSession: 2000,
      images: [IMG('photo-1587300003388-59208cc962cb')],
      loc: { address: 'Patan, Lalitpur', coordinates: { lat: 27.6761, lng: 85.324 } },
    },
    {
      name: 'K9 Academy Nepal — Puppy Basics',
      serviceType: 'Training',
      pricePerSession: 1800,
      images: [IMG('photo-1548199973-03cce0bbc87b')],
      loc: { address: 'Budhanilkantha, Kathmandu', coordinates: { lat: 27.775, lng: 85.3667 } },
    },
  ];

  for (const d of careDefs) {
    const doc = await upsertHostelByName(d.name, {
      ownerId: careOwner._id,
      name: d.name,
      description:
        d.serviceType === 'Grooming'
          ? 'Bath, blow-dry, nail trim, coat care, and gentle handling.'
          : 'Positive-reinforcement obedience, leash manners, and recall.',
      location: d.loc,
      pricePerNight: 0,
      pricePerSession: d.pricePerSession,
      images: d.images,
      amenities: ['WiFi', 'Vet on call', 'Daily updates'],
      rating: 4.7,
      reviewCount: 24,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      isFeatured: true,
      serviceType: d.serviceType,
    });
    log('Care centre upserted:', doc.name);
  }

  // Shop products (10)
  const seller = await ensureUser({
    email: 'seed.shop@pawsewa.local',
    name: 'PawSewa Core Shop',
    role: 'shop_owner',
    extra: { shopName: 'PawSewa Core Shop', facilityName: 'PawSewa Core Shop', phone: '9802222333' },
  });

  const catFood = await ensureCategory('pet-food', 'Pet Food');
  const catMeds = await ensureCategory('medicines', 'Medicines');
  const catAcc = await ensureCategory('accessories', 'Accessories');
  const catGroom = await ensureCategory('grooming-kits', 'Grooming Kits');

  const products = [
    {
      name: 'Salmon & Sweet Potato Adult Dog Food',
      description: 'High-protein kibble with omega blend for coat and joint support.',
      price: 2890,
      stockQuantity: 80,
      category: catFood._id,
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
      category: catFood._id,
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
      category: catFood._id,
      targetPets: ['RABBIT'],
      images: [IMG('photo-1585110396000-c9ffd4e4b308')],
      tags: ['Hay', 'RABBIT'],
      badge: '',
    },
    {
      name: 'Broad-Spectrum Dewormer Chews (Dog)',
      description: 'Follow your veterinarian’s dosing chart. Beef-flavored chewables.',
      price: 1450,
      stockQuantity: 40,
      category: catMeds._id,
      targetPets: ['DOG'],
      images: [IMG('photo-1587854692152-cbe660dbde88')],
      tags: ['Parasite', 'DOG'],
      badge: 'HEALTH',
    },
    {
      name: 'Flea & Tick Spot-On (Cat)',
      description: 'Monthly topical protection; consult your vet for weight band.',
      price: 1320,
      stockQuantity: 55,
      category: catMeds._id,
      targetPets: ['CAT'],
      images: [IMG('photo-1450778869180-41d0601e046e')],
      tags: ['Parasite', 'CAT'],
      badge: '',
    },
    {
      name: 'Adjustable Reflective Harness',
      description: 'Padded chest plate, four-point adjustment, night-reflective trim.',
      price: 1890,
      stockQuantity: 95,
      category: catAcc._id,
      targetPets: ['DOG'],
      images: [IMG('photo-1601758224634-281c0353bd1b')],
      tags: ['Walk', 'Safety'],
      badge: '',
    },
    {
      name: 'Travel Carrier (Airline-Ready)',
      description: 'Ventilated hard-shell carrier with secure latch — cabin size.',
      price: 5200,
      stockQuantity: 28,
      category: catAcc._id,
      targetPets: ['CAT', 'DOG'],
      images: [IMG('photo-1548199973-03cce0bbc87b')],
      tags: ['Travel'],
      badge: '',
    },
    {
      name: 'Ceramic Slow-Feed Bowl',
      description: 'Maze pattern reduces gulp eating; dishwasher safe.',
      price: 1450,
      stockQuantity: 70,
      category: catAcc._id,
      targetPets: ['DOG', 'CAT'],
      images: [IMG('photo-1560743178-567de3b53c4f')],
      tags: ['Feeding'],
      badge: '',
    },
    {
      name: 'Pro Grooming Kit — Shedding Control',
      description: 'Undercoat rake, slicker, comb, and nail clippers in carry case.',
      price: 2490,
      stockQuantity: 45,
      category: catGroom._id,
      targetPets: ['DOG', 'CAT'],
      images: [IMG('photo-1516734212186-a967d32f9e88')],
      tags: ['Grooming'],
      badge: 'CARE',
    },
    {
      name: 'Spa Wash & Dry Starter Pack',
      description: 'Hypoallergenic shampoo, conditioner, microfiber towels, and dryer glove.',
      price: 2180,
      stockQuantity: 38,
      category: catGroom._id,
      targetPets: ['DOG', 'CAT'],
      images: [IMG('photo-1583337130417-334622a1fd0a')],
      tags: ['Bath'],
      badge: '',
    },
  ];

  for (const p of products) {
    await upsertProductByNameSeller(p.name, seller._id, {
      ...p,
      seller: seller._id,
      vendorId: seller._id,
      isAvailable: true,
      rating: 4.6,
      reviewCount: 42,
      petTypes: [], // legacy field; recommender reads targetPets first
    });
    log('Product upserted:', p.name);
  }

  log('Seed complete. Login password for seeded accounts:', DEFAULT_PASSWORD);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error('[seed-core] FAILED:', e.message || e);
  mongoose.disconnect().finally(() => process.exit(1));
});

