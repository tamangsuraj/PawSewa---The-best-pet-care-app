/**
 * Seed dummy data for Hostels, Trainings, and Centers in pawsewa_production.
 * Only inserts when the collection is empty (countDocuments() === 0).
 * Requires: backend/.env with MONGO_URI and DB_NAME=pawsewa_production.
 * Usage: node scripts/seed-hostels-trainings-centers.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getConnectionUri } = require('../src/config/db');

const Hostel = require('../src/models/Hostel');
const User = require('../src/models/User');
const Subscription = require('../src/models/Subscription');
const Training = require('../src/models/Training');
const Center = require('../src/models/Center');

function log(level, ...args) {
  const ts = new Date().toISOString();
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log(`[${ts}] [${level}] ${msg}`);
}

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800';

const HOSTELS = [
  { name: 'PawSewa Luxury Stay', location: { address: 'Thamel, Kathmandu', coordinates: { lat: 27.7172, lng: 85.324 } }, pricePerNight: 1200, rating: 4.8, description: 'Premium boarding with daily walks and play sessions.' },
  { name: 'Kathmandu Pet Retreat', location: { address: 'Boudha, Kathmandu', coordinates: { lat: 27.7212, lng: 85.3614 } }, pricePerNight: 950, rating: 4.5, description: 'Peaceful retreat with indoor and outdoor spaces.' },
  { name: 'Happy Paws Lodge', location: { address: 'Lalitpur, Kathmandu Valley', coordinates: { lat: 27.6710, lng: 85.3240 } }, pricePerNight: 800, rating: 4.3, description: 'Family-run lodge with personalized care.' },
  { name: 'Valley Pet Haven', location: { address: 'Koteshwor, Kathmandu', coordinates: { lat: 27.6789, lng: 85.3456 } }, pricePerNight: 1100, rating: 4.6, description: 'Secure facility with 24/7 supervision.' },
  { name: 'Green Pastures Boarding', location: { address: 'Budhanilkantha, Kathmandu', coordinates: { lat: 27.7750, lng: 85.3667 } }, pricePerNight: 1300, rating: 4.9, description: 'Spacious grounds and vet on call.' },
];

const TRAININGS = [
  { title: 'Basic Obedience', duration: '6 weeks', difficulty: 'Beginner', tutorName: 'Ram Sharma' },
  { title: 'Agility Training', duration: '8 weeks', difficulty: 'Intermediate', tutorName: 'Sita Gurung' },
  { title: 'Puppy Socialization', duration: '4 weeks', difficulty: 'Beginner', tutorName: 'Gita Adhikari' },
  { title: 'Advanced Commands', duration: '10 weeks', difficulty: 'Advanced', tutorName: 'Krishna Thapa' },
];

const CENTERS = [
  { name: 'PawSewa Training Center', address: 'Thamel, Kathmandu', contact: '+977-1-4123456' },
  { name: 'Valley Canine Academy', address: 'Lalitpur, Kathmandu Valley', contact: '+977-1-5544332' },
  { name: 'Happy Tails Training Hub', address: 'Boudha, Kathmandu', contact: '+977-1-4987654' },
];

// Grooming and Spa listings (Hostel model with serviceType Grooming/Spa)
const GROOMING_HOSTELS = [
  { name: 'PawSewa Grooming Studio', location: { address: 'Thamel, Kathmandu', coordinates: { lat: 27.7172, lng: 85.324 } }, pricePerSession: 800, rating: 4.7, description: 'Full grooming, nail trim, and bath packages.' },
  { name: 'Fluffy Tails Grooming', location: { address: 'Boudha, Kathmandu', coordinates: { lat: 27.7212, lng: 85.3614 } }, pricePerSession: 650, rating: 4.5, description: 'Gentle grooming for all breeds and sizes.' },
  { name: 'Valley Pet Spa & Grooming', location: { address: 'Lalitpur, Kathmandu Valley', coordinates: { lat: 27.6710, lng: 85.3240 } }, pricePerSession: 950, rating: 4.8, description: 'Premium grooming with spa add-ons.' },
];
const SPA_HOSTELS = [
  { name: 'PawSewa Pet Spa', location: { address: 'Koteshwor, Kathmandu', coordinates: { lat: 27.6789, lng: 85.3456 } }, pricePerSession: 1200, rating: 4.9, description: 'Full spa day: bath, massage, and coat treatment.' },
  { name: 'Serenity Pet Spa', location: { address: 'Budhanilkantha, Kathmandu', coordinates: { lat: 27.7750, lng: 85.3667 } }, pricePerSession: 1100, rating: 4.6, description: 'Relaxing spa treatments and aromatherapy.' },
];

async function ensureSubscription(ownerId) {
  const existing = await Subscription.findOne({ providerId: ownerId, status: 'active', validUntil: { $gt: new Date() } });
  if (existing) return;
  await Subscription.create({
    providerId: ownerId,
    plan: 'premium',
    billingCycle: 'yearly',
    status: 'active',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    amountPaid: 15000,
  });
  log('INFO', 'Created subscription for seed owner.');
}

async function run() {
  const uri = getConnectionUri();
  log('INFO', 'Connecting to database...');
  await mongoose.connect(uri, {
    tls: uri.startsWith('mongodb+srv'),
    tlsAllowInvalidCertificates: true,
  });
  const dbName = mongoose.connection.db?.databaseName || 'unknown';
  log('INFO', 'Connected to', dbName);

  const firstUser = await User.findOne().select('_id').lean();
  if (!firstUser) {
    log('ERROR', 'No user found. Create at least one user before seeding.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const ownerId = firstUser._id;

  if ((await Hostel.countDocuments()) === 0) {
    log('INFO', 'Seeding Hostels...');
    await ensureSubscription(ownerId);
    const hostelsToInsert = HOSTELS.map((h) => ({
      ownerId,
      name: h.name,
      description: h.description,
      location: h.location,
      pricePerNight: h.pricePerNight,
      images: [PLACEHOLDER_IMAGE],
      amenities: ['WiFi', 'Play area', 'Daily walks'],
      rating: h.rating,
      reviewCount: 0,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Hostel',
    }));
    await Hostel.insertMany(hostelsToInsert);
    log('INFO', 'Seeding Hostels... Done (5 records)');
  } else {
    log('INFO', 'Seeding Hostels... Skipped (collection not empty)');
  }

  if ((await Hostel.countDocuments({ serviceType: 'Training' })) === 0) {
    log('INFO', 'Seeding Training hostels...');
    const trainingHostels = [
      { name: 'Basic Obedience Program', location: { address: 'Thamel, Kathmandu', coordinates: { lat: 27.7172, lng: 85.324 } }, pricePerSession: 1500, rating: 4.7, description: '6-week basic obedience with Ram Sharma.' },
      { name: 'Agility Training Center', location: { address: 'Lalitpur, Kathmandu Valley', coordinates: { lat: 27.6710, lng: 85.3240 } }, pricePerSession: 2000, rating: 4.8, description: '8-week agility with Sita Gurung.' },
      { name: 'Puppy Socialization Classes', location: { address: 'Boudha, Kathmandu', coordinates: { lat: 27.7212, lng: 85.3614 } }, pricePerSession: 1200, rating: 4.5, description: '4-week puppy socialization with Gita Adhikari.' },
      { name: 'Advanced Commands Workshop', location: { address: 'Koteshwor, Kathmandu', coordinates: { lat: 27.6789, lng: 85.3456 } }, pricePerSession: 2500, rating: 4.9, description: '10-week advanced training with Krishna Thapa.' },
    ];
    const withOwner = trainingHostels.map((h) => ({
      ownerId,
      name: h.name,
      description: h.description,
      location: h.location,
      pricePerNight: 0,
      pricePerSession: h.pricePerSession,
      images: [PLACEHOLDER_IMAGE],
      amenities: ['Indoor arena', 'Equipment provided'],
      rating: h.rating,
      reviewCount: 0,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Training',
    }));
    await Hostel.insertMany(withOwner);
    log('INFO', 'Seeding Training hostels... Done (4 records)');
  } else {
    log('INFO', 'Seeding Training hostels... Skipped (collection not empty)');
  }

  if ((await Hostel.countDocuments({ serviceType: 'Grooming' })) === 0) {
    log('INFO', 'Seeding Grooming hostels...');
    await ensureSubscription(ownerId);
    const groomingToInsert = GROOMING_HOSTELS.map((h) => ({
      ownerId,
      name: h.name,
      description: h.description,
      location: h.location,
      pricePerNight: 0,
      pricePerSession: h.pricePerSession,
      images: [PLACEHOLDER_IMAGE],
      amenities: ['Professional groomers', 'Bath & dry', 'Nail trim'],
      rating: h.rating,
      reviewCount: 0,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Grooming',
    }));
    await Hostel.insertMany(groomingToInsert);
    log('INFO', 'Seeding Grooming hostels... Done (3 records)');
  } else {
    log('INFO', 'Seeding Grooming hostels... Skipped (collection not empty)');
  }

  if ((await Hostel.countDocuments({ serviceType: 'Spa' })) === 0) {
    log('INFO', 'Seeding Spa hostels...');
    await ensureSubscription(ownerId);
    const spaToInsert = SPA_HOSTELS.map((h) => ({
      ownerId,
      name: h.name,
      description: h.description,
      location: h.location,
      pricePerNight: 0,
      pricePerSession: h.pricePerSession,
      images: [PLACEHOLDER_IMAGE],
      amenities: ['Spa baths', 'Coat treatment', 'Massage'],
      rating: h.rating,
      reviewCount: 0,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: 'Spa',
    }));
    await Hostel.insertMany(spaToInsert);
    log('INFO', 'Seeding Spa hostels... Done (2 records)');
  } else {
    log('INFO', 'Seeding Spa hostels... Skipped (collection not empty)');
  }

  if ((await Training.countDocuments()) === 0) {
    log('INFO', 'Seeding Trainings...');
    await Training.insertMany(TRAININGS);
    log('INFO', 'Seeding Trainings... Done (4 records)');
  } else {
    log('INFO', 'Seeding Trainings... Skipped (collection not empty)');
  }

  if ((await Center.countDocuments()) === 0) {
    log('INFO', 'Seeding Centers...');
    await Center.insertMany(CENTERS);
    log('INFO', 'Seeding Centers... Done (3 records)');
  } else {
    log('INFO', 'Seeding Centers... Skipped (collection not empty)');
  }

  await mongoose.disconnect();
  log('INFO', 'Seed script finished.');
  process.exit(0);
}

run().catch((e) => {
  log('ERROR', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
