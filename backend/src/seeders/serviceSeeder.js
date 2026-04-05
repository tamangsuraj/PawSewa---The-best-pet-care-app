/**
 * Pet Care+ premium dummy data for Hostel model (all care serviceType values).
 * Clears existing hostels, ensures vendor users + active premium subscriptions, then inserts rows.
 *
 * Matches Flutter / admin / web enums: Hostel, Daycare, Grooming, Training, Wash, Spa (PascalCase).
 *
 * Usage (from repo backend/):  node src/seeders/serviceSeeder.js
 * Env: MONGO_URI, optional DB_NAME. Optional SEED_VENDOR_PASSWORD (default SeedVendor#2026).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Hostel = require('../models/Hostel');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Training = require('../models/Training');
const Center = require('../models/Center');
const CareBooking = require('../models/CareBooking');
const Pet = require('../models/Pet');

const DEFAULT_VENDOR_PASSWORD = process.env.SEED_VENDOR_PASSWORD || 'SeedVendor#2026';

/** High-res Unsplash — dogs, grooming, training, daycare vibes (w=1400 for crisp cards). */
const IMG = {
  golden: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=1400&q=85',
  grooming: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1400&q=85',
  puppy: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1400&q=85',
  training: 'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?auto=format&fit=crop&w=1400&q=85',
  bath: 'https://images.unsplash.com/photo-1522276492815-f0eb71f75a7d?auto=format&fit=crop&w=1400&q=85',
  run: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=85',
  friends: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1400&q=85',
  salon: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1400&q=85',
  indoor: 'https://images.unsplash.com/photo-1560743173-567a3ec663d8?auto=format&fit=crop&w=1400&q=85',
  agility: 'https://images.unsplash.com/photo-1598133894008-61f6fdb8cc3a?auto=format&fit=crop&w=1400&q=85',
  wash: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1400&q=85',
  spa: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=1400&q=85',
};

const VENDORS = [
  { email: 'ravi.karki.hostel@pawsewa.com', name: 'Ravi Karki', role: 'hostel_owner', phone: '+977-9801110001' },
  { email: 'sita.gurung.daycare@pawsewa.com', name: 'Sita Gurung', role: 'facility_owner', phone: '+977-9801110002' },
  { email: 'maya.tamang.groom@pawsewa.com', name: 'Maya Tamang', role: 'groomer', phone: '+977-9801110003' },
  { email: 'dipesh.shrestha.train@pawsewa.com', name: 'Dipesh Shrestha', role: 'trainer', phone: '+977-9801110004' },
  { email: 'anita.kc.wash@pawsewa.com', name: 'Anita KC', role: 'service_provider', phone: '+977-9801110005' },
  { email: 'sarita.basnet.spa@pawsewa.com', name: 'Sarita Basnet', role: 'groomer', phone: '+977-9801110006' },
];

/** Kathmandu Valley coordinates (approx). */
const L = {
  thamel: { lat: 27.7172, lng: 85.324 },
  lalitpur: { lat: 27.6588, lng: 85.3244 },
  maharajgunj: { lat: 27.735, lng: 85.337 },
  baneshwor: { lat: 27.6856, lng: 85.3425 },
  budhanilkantha: { lat: 27.783, lng: 85.365 },
  bhaktapur: { lat: 27.671, lng: 85.4298 },
  jawalakhel: { lat: 27.664, lng: 85.315 },
  kapan: { lat: 27.728, lng: 85.357 },
  patan: { lat: 27.673, lng: 85.322 },
};

/**
 * @returns {Array<{serviceType:string, name:string, address:string, coords:object, rating:number, priceNight?:number, priceSession?:number, description:string, images:string[], amenities:string[]}>}
 */
function buildCatalog() {
  return [
    // —— Pet Hostels (pricePerNight) ——
    {
      serviceType: 'Hostel',
      name: "Paw's Paradise Hostel",
      address: 'Thamel, Kathmandu',
      coords: L.thamel,
      rating: 4.9,
      priceNight: 500,
      description: 'Spacious suites, twice-daily walks, and 24/7 supervision in the heart of Thamel.',
      images: [IMG.golden, IMG.run],
      amenities: ['AC rooms', 'Play yard', 'Vet on call', 'Webcam updates'],
    },
    {
      serviceType: 'Hostel',
      name: 'Elite Canine Retreat',
      address: 'Budhanilkantha, Kathmandu',
      coords: L.budhanilkantha,
      rating: 4.85,
      priceNight: 1200,
      description: 'Premium boarding with garden runs and personalized meal plans.',
      images: [IMG.indoor, IMG.golden],
      amenities: ['Garden runs', 'Gourmet meals', 'Grooming add-ons'],
    },
    {
      serviceType: 'Hostel',
      name: 'Himalayan Paws Lodge',
      address: 'Lalitpur',
      coords: L.lalitpur,
      rating: 4.55,
      priceNight: 750,
      description: 'Family-run lodge with cozy kennels and social play groups.',
      images: [IMG.friends, IMG.puppy],
      amenities: ['Social play', 'Heated floors', 'Pickup service'],
    },
    {
      serviceType: 'Hostel',
      name: 'Valley View Pet Inn',
      address: 'Maharajgunj, Kathmandu',
      coords: L.maharajgunj,
      rating: 4.7,
      priceNight: 950,
      description: 'Quiet neighborhood stay with rooftop exercise deck.',
      images: [IMG.run, IMG.indoor],
      amenities: ['Rooftop deck', 'Daily photos', 'Medication admin'],
    },
    // —— Daycare ——
    {
      serviceType: 'Daycare',
      name: 'Happy Tails Daycare',
      address: 'Lalitpur',
      coords: L.lalitpur,
      rating: 4.8,
      priceSession: 350,
      description: 'Supervised play, rest pods, and trained handlers for busy weekdays.',
      images: [IMG.puppy, IMG.run],
      amenities: ['Indoor play', 'Rest pods', 'Half-day slots'],
    },
    {
      serviceType: 'Daycare',
      name: 'Sunny Paws Lounge',
      address: 'Jawalakhel, Lalitpur',
      coords: L.jawalakhel,
      rating: 4.65,
      priceSession: 420,
      description: 'Bright daycare floor with agility toys and splash pad.',
      images: [IMG.run, IMG.friends],
      amenities: ['Splash pad', 'Agility toys', 'Report card'],
    },
    {
      serviceType: 'Daycare',
      name: 'Little Paws Playhouse',
      address: 'Baneshwor, Kathmandu',
      coords: L.baneshwor,
      rating: 4.45,
      priceSession: 380,
      description: 'Small-dog friendly groups and puppy socialization mornings.',
      images: [IMG.puppy, IMG.indoor],
      amenities: ['Size-separated groups', 'Puppy hour', 'Treats included'],
    },
    {
      serviceType: 'Daycare',
      name: 'Downtown Doggie Daycamp',
      address: 'Thamel, Kathmandu',
      coords: L.thamel,
      rating: 4.72,
      priceSession: 500,
      description: 'Extended hours (7am–8pm) perfect for commuters.',
      images: [IMG.golden, IMG.run],
      amenities: ['Extended hours', 'Shuttle radius 3km', 'Nap suites'],
    },
    // —— Grooming ——
    {
      serviceType: 'Grooming',
      name: 'Posh Paws Spa',
      address: 'Maharajgunj, Kathmandu',
      coords: L.maharajgunj,
      rating: 4.8,
      priceSession: 800,
      description: 'Full-service cuts, breed-standard styling, and spa finishing.',
      images: [IMG.grooming, IMG.salon],
      amenities: ['Breed cuts', 'Nail spa', 'Teeth wipe'],
    },
    {
      serviceType: 'Grooming',
      name: 'Bubble Bath Boutique',
      address: 'Thamel, Kathmandu',
      coords: L.thamel,
      rating: 4.68,
      priceSession: 1200,
      description: 'Premium bath packages with organic shampoos and blow-dry styling.',
      images: [IMG.bath, IMG.grooming],
      amenities: ['Organic shampoo', 'Blueberry facial', 'Bow tie finish'],
    },
    {
      serviceType: 'Grooming',
      name: 'The Dapper Dog Studio',
      address: 'Patan, Lalitpur',
      coords: L.patan,
      rating: 4.52,
      priceSession: 650,
      description: 'Quick tidy-ups and full grooms by certified stylists.',
      images: [IMG.salon, IMG.puppy],
      amenities: ['Express slots', 'Hand-scissoring', 'De-shedding'],
    },
    {
      serviceType: 'Grooming',
      name: 'Fluff & Friends Grooming',
      address: 'Kapan, Kathmandu',
      coords: L.kapan,
      rating: 4.9,
      priceSession: 950,
      description: 'Large-breed friendly tables and low-stress handling.',
      images: [IMG.grooming, IMG.friends],
      amenities: ['Large tables', 'Fear-free', 'Pickup 5km'],
    },
    // —— Training ——
    {
      serviceType: 'Training',
      name: 'K9 Academy Nepal',
      address: 'Budhanilkantha, Kathmandu',
      coords: L.budhanilkantha,
      rating: 4.88,
      priceSession: 5000,
      description: 'Structured obedience courses with certified trainers and field work.',
      images: [IMG.training, IMG.agility],
      amenities: ['Group classes', 'Field sessions', 'Homework app'],
    },
    {
      serviceType: 'Training',
      name: 'Smart Pet School',
      address: 'Bhaktapur',
      coords: L.bhaktapur,
      rating: 4.76,
      priceSession: 3200,
      description: 'Positive-reinforcement puppy foundations and adolescent manners.',
      images: [IMG.puppy, IMG.training],
      amenities: ['Puppy socials', '1:1 consults', 'Video notes'],
    },
    {
      serviceType: 'Training',
      name: 'Valley Obedience Club',
      address: 'Baneshwor, Kathmandu',
      coords: L.baneshwor,
      rating: 4.42,
      priceSession: 2800,
      description: 'Weekend agility intro and leash-reactivity workshops.',
      images: [IMG.agility, IMG.run],
      amenities: ['Agility intro', 'Leash workshops', 'Family welcome'],
    },
    {
      serviceType: 'Training',
      name: 'PupStart Training Nepal',
      address: 'Lalitpur',
      coords: L.lalitpur,
      rating: 4.63,
      priceSession: 4500,
      description: 'Board-and-train intensives plus transition sessions at home.',
      images: [IMG.training, IMG.golden],
      amenities: ['Board & train', 'Home transition', 'Lifetime tips line'],
    },
    // —— Wash ——
    {
      serviceType: 'Wash',
      name: 'Quick Wash & Dry',
      address: 'Baneshwor, Kathmandu',
      coords: L.baneshwor,
      rating: 4.5,
      priceSession: 600,
      description: 'Express self-serve bays plus full-service wash in under 45 minutes.',
      images: [IMG.wash, IMG.bath],
      amenities: ['Express 45m', 'Blow-dry', 'Flea rinse add-on'],
    },
    {
      serviceType: 'Wash',
      name: 'Puppy Scrub Station',
      address: 'Thamel, Kathmandu',
      coords: L.thamel,
      rating: 4.35,
      priceSession: 450,
      description: 'Gentle first baths for puppies with warm-water ramps.',
      images: [IMG.puppy, IMG.wash],
      amenities: ['Warm ramps', 'Tearless soap', 'Treat rewards'],
    },
    {
      serviceType: 'Wash',
      name: "Splash N' Wag Express",
      address: 'Jawalakhel, Lalitpur',
      coords: L.jawalakhel,
      rating: 4.58,
      priceSession: 550,
      description: 'Drive-through style drop-off with text-when-ready pickup.',
      images: [IMG.bath, IMG.wash],
      amenities: ['Text alerts', 'Deodorizing spray', 'Towel warmers'],
    },
    {
      serviceType: 'Wash',
      name: 'Clean Paws Auto Wash',
      address: 'Maharajgunj, Kathmandu',
      coords: L.maharajgunj,
      rating: 4.22,
      priceSession: 520,
      description: 'Membership washes and double-coat rinse packages.',
      images: [IMG.wash, IMG.golden],
      amenities: ['Memberships', 'Undercoat rinse', 'Nail grind'],
    },
    // —— Spa (extra category for Pet Care+ UI) ——
    {
      serviceType: 'Spa',
      name: 'Serenity Canine Spa',
      address: 'Lalitpur',
      coords: L.lalitpur,
      rating: 4.92,
      priceSession: 1500,
      description: 'Full spa day: aromatherapy bath, paw balm, and coat masque.',
      images: [IMG.spa, IMG.grooming],
      amenities: ['Aromatherapy', 'Paw balm', 'Coat masque'],
    },
    {
      serviceType: 'Spa',
      name: 'Opulent Tails Spa Lounge',
      address: 'Thamel, Kathmandu',
      coords: L.thamel,
      rating: 4.81,
      priceSession: 2200,
      description: 'Luxury packages with massage and blueberry facial.',
      images: [IMG.spa, IMG.salon],
      amenities: ['Massage', 'Blueberry facial', 'Champagne toy'],
    },
    {
      serviceType: 'Spa',
      name: 'Urban Pet Renewal Spa',
      address: 'Baneshwor, Kathmandu',
      coords: L.baneshwor,
      rating: 4.67,
      priceSession: 1350,
      description: 'City pets: de-shed + hydrating treatment after smog exposure.',
      images: [IMG.spa, IMG.bath],
      amenities: ['Hydrating coat', 'De-shed', 'Charcoal rinse'],
    },
  ];
}

/** Past care bookings for testuser@pawsewa.com (sidebar / history). Requires masterUserSeeder run first. */
async function seedCareBookingsForTestUser(hostelDocs) {
  const testUser = await User.findOne({ email: 'testuser@pawsewa.com' }).select('_id').lean();
  const pet = testUser ? await Pet.findOne({ owner: testUser._id }).select('_id').lean() : null;
  if (!testUser || !pet || !hostelDocs.length) {
    // eslint-disable-next-line no-console
    console.log('[SEEDER] Care booking seed skipped (run masterUserSeeder first or no hostels).');
    return;
  }
  const pick = (type) => hostelDocs.find((h) => h.serviceType === type) || hostelDocs[0];
  const hHostel = pick('Hostel');
  const hGroom = pick('Grooming');
  const now = Date.now();
  const rows = [
    {
      hostelId: hHostel._id,
      petId: pet._id,
      userId: testUser._id,
      checkIn: new Date(now - 14 * 86400000),
      checkOut: new Date(now - 10 * 86400000),
      roomType: 'Standard suite',
      nights: 4,
      subtotal: 2000,
      totalAmount: 2200,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'cash_on_delivery',
      serviceType: 'Hostel',
      packageName: 'Boarding — standard',
    },
    {
      hostelId: hGroom._id,
      petId: pet._id,
      userId: testUser._id,
      checkIn: new Date(now - 3 * 86400000),
      checkOut: new Date(now - 3 * 86400000),
      roomType: 'Salon slot',
      nights: 1,
      subtotal: 800,
      totalAmount: 880,
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod: 'online',
      serviceType: 'Grooming',
      packageName: 'Full groom — deluxe',
    },
  ];
  await CareBooking.insertMany(rows);
  // eslint-disable-next-line no-console
  console.log('[SEEDER] Care booking history linked to testuser@pawsewa.com (2 rows).');
}

function vendorForServiceType(serviceType) {
  const map = {
    Hostel: 'ravi.karki.hostel@pawsewa.com',
    Daycare: 'sita.gurung.daycare@pawsewa.com',
    Grooming: 'maya.tamang.groom@pawsewa.com',
    Training: 'dipesh.shrestha.train@pawsewa.com',
    Wash: 'anita.kc.wash@pawsewa.com',
    Spa: 'sarita.basnet.spa@pawsewa.com',
  };
  return map[serviceType] || VENDORS[0].email;
}

async function ensureVendor(def) {
  let user = await User.findOne({ email: def.email });
  if (!user) {
    user = await User.create({
      email: def.email,
      name: def.name,
      password: DEFAULT_VENDOR_PASSWORD,
      role: def.role,
      phone: def.phone,
    });
  }
  const sub = await Subscription.findOne({
    providerId: user._id,
    status: 'active',
    validUntil: { $gt: new Date() },
  });
  if (!sub) {
    await Subscription.create({
      providerId: user._id,
      plan: 'premium',
      billingCycle: 'yearly',
      status: 'active',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      amountPaid: 15000,
    });
  }
  return user;
}

async function run() {
  await connectDB();

  await Training.deleteMany({});
  await Center.deleteMany({});
  const deleted = await Hostel.deleteMany({});
  // eslint-disable-next-line no-console
  console.log('[CLEANUP] All existing hostel/service rows wiped.');
  // eslint-disable-next-line no-console
  console.log(`[SEEDER] Removed ${deleted.deletedCount} hostel documents (trainings + centers cleared).`);

  const vendorByEmail = {};
  for (const def of VENDORS) {
    vendorByEmail[def.email] = await ensureVendor(def);
  }

  const catalog = buildCatalog();
  const docs = catalog.map((item, idx) => {
    const email = vendorForServiceType(item.serviceType);
    const ownerId = vendorByEmail[email]._id;
    const isNight = item.serviceType === 'Hostel';
    const reviewCount = 12 + (idx % 41);

    return {
      ownerId,
      name: item.name,
      description: item.description,
      location: {
        address: item.address,
        coordinates: item.coords,
      },
      pricePerNight: isNight ? item.priceNight : 0,
      pricePerSession: isNight ? undefined : item.priceSession,
      images: item.images,
      amenities: item.amenities,
      rating: item.rating,
      reviewCount,
      isVerified: true,
      isActive: true,
      isAvailable: true,
      serviceType: item.serviceType,
      schedule: [
        { time: '09:00', activity: 'Check-in & assessment' },
        { time: '15:00', activity: 'Play / training block' },
      ],
      staff: [
        { name: 'Lead Care Staff', experienceYears: 5 },
        { name: 'Senior Handler', experienceYears: 3 },
      ],
    };
  });

  const inserted = await Hostel.insertMany(docs);
  const n = inserted.length;
  if (n >= 20) {
    // eslint-disable-next-line no-console
    console.log('[SEEDER] Successfully created 20+ premium pet services.');
  } else {
    // eslint-disable-next-line no-console
    console.log(`[SEEDER] Successfully created ${n} premium pet services.`);
  }

  await seedCareBookingsForTestUser(inserted);

  // eslint-disable-next-line no-console
  console.log('[SUCCESS] Database re-seeded. Master User and Care Services active.');

  await mongoose.disconnect();
  // eslint-disable-next-line no-console
  console.log('[SEEDER] Done. Vendor logins (password from SEED_VENDOR_PASSWORD or SeedVendor#2026):');
  for (const v of VENDORS) {
    // eslint-disable-next-line no-console
    console.log(`[SEEDER]   ${v.email}  (${v.role})`);
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[SEEDER] Failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
