/**
 * Master test user: testuser@pawsewa.com with full ecosystem history for sidebar / History UIs.
 *
 * Prerequisites (typical):
 *   - Products in DB (shop seed)
 *   - Hostels from serviceSeeder: Paw's Paradise Hostel, Posh Paws Spa, K9 Academy Nepal
 *
 * Customer Care admin uses fixed _id 697ca0d530a61a7f06e3d1ef (set CUSTOMER_CARE_ADMIN_ID in .env to match).
 *
 * Run: npm run seed:master-user
 *
 * Env:
 *   TEST_USER_PASSWORD — default password123
 *   MASTER_ADMIN_EMAIL / MASTER_ADMIN_PASSWORD — only used when creating the care admin user
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { ensureDefaultCustomerCareConversation } = require('../services/customerCareService');
const { makeVetDirectRoomId } = require('../utils/vetChatEligibility');

const User = require('../models/User');
const Pet = require('../models/Pet');
const ServiceRequest = require('../models/ServiceRequest');
const ServiceRequestMessage = require('../models/ServiceRequestMessage');
const Chat = require('../models/Chat');
const Order = require('../models/Order');
const Product = require('../models/Product');
const CareBooking = require('../models/CareBooking');
const Case = require('../models/Case');
const Favourite = require('../models/Favourite');
const Notification = require('../models/Notification');
const VetDirectMessage = require('../models/VetDirectMessage');
const MarketplaceConversation = require('../models/MarketplaceConversation');
const MarketplaceMessage = require('../models/MarketplaceMessage');
const Hostel = require('../models/Hostel');
const Appointment = require('../models/Appointment');

const CARE_ADMIN_ID_STR = '697ca0d530a61a7f06e3d1ef';
const TEST_EMAIL = 'testuser@pawsewa.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';
const DUMMY_FCM = 'fcm_dummy_master_testuser_pawsewa_2026';

async function clearArtifactsForUser(userId) {
  const uid = userId;
  const srs = await ServiceRequest.find({ user: uid }).select('_id').lean();
  const srIds = srs.map((s) => s._id);

  await ServiceRequestMessage.deleteMany({ serviceRequest: { $in: srIds } });
  await Chat.deleteMany({ serviceRequest: { $in: srIds } });
  await ServiceRequest.deleteMany({ user: uid });

  const convs = await MarketplaceConversation.find({ customer: uid }).select('_id').lean();
  const convIds = convs.map((c) => c._id);
  await MarketplaceMessage.deleteMany({ conversation: { $in: convIds } });
  await MarketplaceConversation.deleteMany({ customer: uid });

  await VetDirectMessage.deleteMany({ ownerUser: uid });
  await Order.deleteMany({ user: uid });
  await CareBooking.deleteMany({ userId: uid });
  await Appointment.deleteMany({ owner: uid });
  await Case.deleteMany({ customer: uid });
  await Favourite.deleteMany({ user: uid });
  await Notification.deleteMany({ user: uid });
  await Pet.deleteMany({ owner: uid });
}

async function ensureCustomerCareAdmin() {
  const id = new mongoose.Types.ObjectId(CARE_ADMIN_ID_STR);
  let admin = await User.findById(id);
  if (admin) return admin;

  let email = (process.env.MASTER_ADMIN_EMAIL || 'customer-care@pawsewa.com').toLowerCase().trim();
  if (await User.findOne({ email })) {
    email = `care-admin-${CARE_ADMIN_ID_STR.slice(-8)}@pawsewa.com`;
  }

  admin = await User.create({
    _id: id,
    name: 'PawSewa Customer Care',
    email,
    password: process.env.MASTER_ADMIN_PASSWORD || 'Admin#2026',
    role: 'admin',
    isVerified: true,
    phone: '9800000001',
  });
  // eslint-disable-next-line no-console
  console.log('[SEEDER] Created Customer Care admin', email, '| _id:', CARE_ADMIN_ID_STR);
  return admin;
}

async function ensureVet() {
  let vet = await User.findOne({ role: { $in: ['veterinarian', 'vet'] } })
    .sort({ createdAt: 1 })
    .select('_id name email');
  if (vet) return vet;

  vet = await User.create({
    name: 'Dr. Binod Poudel',
    email: 'binod.poudel.vet@pawsewa.com',
    password: 'VetSeed#2026',
    role: 'veterinarian',
    isVerified: true,
    phone: '9801111222',
    clinicName: 'Valley Pet Clinic',
    clinicLocation: 'Kathmandu',
  });
  // eslint-disable-next-line no-console
  console.log('[SEEDER] Created veterinarian for appointments / vet chat:', vet.email);
  return vet;
}

async function ensureRider() {
  let rider = await User.findOne({ role: 'rider' }).sort({ createdAt: 1 }).select('_id name');
  if (rider) return rider;

  rider = await User.create({
    name: 'Ramesh Magar',
    email: 'ramesh.magar@pawsewa.com',
    password: 'RiderSeed#2026',
    role: 'rider',
    isVerified: true,
    phone: '9803333444',
    vehicleType: 'Bike',
  });
  // eslint-disable-next-line no-console
  console.log('[SEEDER] Created rider for delivered orders:', rider.email);
  return rider;
}

async function upsertMasterUser() {
  let user = await User.findOne({ email: TEST_EMAIL }).select('+fcmTokens');
  if (user) {
    await clearArtifactsForUser(user._id);
    user.name = user.name || 'Amrita Koirala';
    user.password = TEST_PASSWORD;
    user.role = 'CUSTOMER';
    user.isVerified = true;
    user.fcmTokens = [DUMMY_FCM];
    await user.save();
    await ensureDefaultCustomerCareConversation(user._id);
    return user;
  }

  user = await User.create({
    name: 'Amrita Koirala',
    email: TEST_EMAIL.toLowerCase().trim(),
    password: TEST_PASSWORD,
    role: 'CUSTOMER',
    isVerified: true,
    phone: '9812345678',
    location: 'Kathmandu',
    fcmTokens: [DUMMY_FCM],
  });
  return user;
}

function findHostelByNamePattern(patterns) {
  return Hostel.findOne({
    $or: patterns.map((p) => ({ name: new RegExp(p, 'i') })),
  }).lean();
}

async function seedPetAndHistory({ testUser, vet, rider }) {
  const pet = await Pet.create({
    owner: testUser._id,
    name: 'Max',
    species: 'Dog',
    breed: 'Golden Retriever',
    gender: 'Male',
    age: 3,
    weight: 14,
    photoUrl:
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=1200&q=85',
    isVaccinated: true,
    medicalHistory: ['Annual Vaccination', 'Skin Allergy Check'],
    linkedVetVisits: [
      {
        veterinarian: vet._id,
        summary: 'Annual Vaccination — rabies & DHPP',
        recordedAt: new Date(Date.now() - 21 * 86400000),
      },
      {
        veterinarian: vet._id,
        summary: 'Skin Allergy Check — hypoallergenic diet advised',
        recordedAt: new Date(Date.now() - 14 * 86400000),
      },
    ],
    lastVetVisit: new Date(Date.now() - 14 * 86400000),
  });

  const loc = {
    address: 'Thamel, Kathmandu',
    coordinates: { lat: 27.715133, lng: 85.312204 },
  };

  await ServiceRequest.create({
    user: testUser._id,
    pet: pet._id,
    petPawId: pet.pawId,
    serviceType: 'Appointment',
    preferredDate: new Date(Date.now() - 21 * 86400000),
    timeWindow: 'Morning (9am-12pm)',
    location: loc,
    status: 'completed',
    assignedStaff: vet._id,
    assignedAt: new Date(Date.now() - 20 * 86400000),
    completedAt: new Date(Date.now() - 19 * 86400000),
    visitNotes: 'Annual wellness and vaccination review — Max is healthy.',
    paymentStatus: 'paid',
    paymentMethod: 'cash_on_delivery',
    notes: 'Completed appointment (sample history)',
  });

  await ServiceRequest.create({
    user: testUser._id,
    pet: pet._id,
    petPawId: pet.pawId,
    serviceType: 'Health Checkup',
    preferredDate: new Date(Date.now() - 14 * 86400000),
    timeWindow: 'Afternoon (12pm-4pm)',
    location: loc,
    status: 'completed',
    assignedStaff: vet._id,
    assignedAt: new Date(Date.now() - 13 * 86400000),
    completedAt: new Date(Date.now() - 12 * 86400000),
    visitNotes: 'Dermatology follow-up — mild allergy; shampoo prescribed.',
    paymentStatus: 'paid',
    paymentMethod: 'online',
    notes: 'Completed skin check (sample history)',
  });

  await Appointment.create({
    pet: pet._id,
    owner: testUser._id,
    veterinarian: vet._id,
    date: new Date(Date.now() - 20 * 86400000),
    timeSlot: '10:00 AM',
    status: 'completed',
  });

  await Appointment.create({
    pet: pet._id,
    owner: testUser._id,
    veterinarian: vet._id,
    date: new Date(Date.now() - 13 * 86400000),
    timeSlot: '2:30 PM',
    status: 'completed',
  });

  await Case.create({
    customer: testUser._id,
    pet: pet._id,
    issueDescription: 'Routine post-visit follow-up',
    location: 'Kathmandu',
    latitude: loc.coordinates.lat,
    longitude: loc.coordinates.lng,
    status: 'completed',
    assignedVet: vet._id,
    shift: 'Morning',
    completedAt: new Date(Date.now() - 11 * 86400000),
    notes: 'Closed after phone follow-up.',
  });

  const product = await Product.findOne({ isAvailable: true }).select('_id name price').lean();
  if (product) {
    const deliveredSpecs = [
      { qty: 1, lat: 27.717245, lng: 85.323991, addr: 'Narayanhiti Marg, Kathmandu' },
      { qty: 2, lat: 27.712891, lng: 85.329104, addr: 'Patan Durbar Square area, Lalitpur' },
      { qty: 1, lat: 27.709234, lng: 85.316782, addr: 'Jhamsikhel, Lalitpur' },
    ];
    let dayOffset = 5;
    for (const spec of deliveredSpecs) {
      const lineTotal = product.price * spec.qty;
      await Order.create({
        user: testUser._id,
        items: [
          {
            product: product._id,
            name: product.name,
            price: product.price,
            quantity: spec.qty,
          },
        ],
        totalAmount: lineTotal,
        paymentStatus: 'paid',
        paymentMethod: 'cod',
        deliveryLocation: {
          address: spec.addr,
          point: { type: 'Point', coordinates: [spec.lng, spec.lat] },
        },
        status: 'delivered',
        assignedRider: rider._id,
        deliveredAt: new Date(Date.now() - dayOffset * 86400000),
      });
      dayOffset += 2;
    }
    // eslint-disable-next-line no-console
    console.log('[SEEDER] 3 delivered shop orders with rider + GPS coordinates.');
  } else {
    // eslint-disable-next-line no-console
    console.warn('[SEEDER] No products in DB — shop orders skipped. Seed products first.');
  }

  const hostelPaws = await findHostelByNamePattern(["Paw's Paradise", 'Paws Paradise']);
  const hostelGroom = await findHostelByNamePattern(['Posh Paws']);
  const hostelTrain = await findHostelByNamePattern(['K9 Academy']);

  if (hostelPaws && hostelGroom && hostelTrain) {
    const now = Date.now();
    const msDay = 24 * 60 * 60 * 1000;
    const mkCare = (hostelDoc, type, nights, subtotal, label, daysOffset) => {
      const checkIn = new Date(now - daysOffset * msDay);
      const checkOut = new Date(checkIn.getTime() + nights * msDay);
      const cleaning = type === 'Hostel' ? 200 : 50;
      const platformFee = Math.round((subtotal + cleaning) * 0.05);
      const totalAmount = subtotal + cleaning + platformFee;
      return {
        hostelId: hostelDoc._id,
        petId: pet._id,
        userId: testUser._id,
        checkIn,
        checkOut,
        roomType: label,
        nights,
        subtotal,
        cleaningFee: cleaning,
        serviceFee: 0,
        platformFee,
        tax: 0,
        totalAmount,
        status: 'completed',
        paymentStatus: 'paid',
        paymentMethod: 'online',
        serviceType: type,
        packageName: label,
        ownerNotes: `${label} — sample booking for demo account`,
      };
    };

    await CareBooking.insertMany([
      mkCare(hostelPaws, 'Hostel', 3, hostelPaws.pricePerNight * 3, 'Standard Suite', 50),
      mkCare(hostelGroom, 'Grooming', 1, hostelGroom.pricePerSession || 800, 'Full Groom', 35),
      mkCare(hostelTrain, 'Training', 1, hostelTrain.pricePerSession || 5000, 'Obedience block', 25),
    ]);
    // eslint-disable-next-line no-console
    console.log('[SEEDER] 3 CareBooking rows (Hostel, Grooming, Training) completed.');
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      '[SEEDER] Missing hostels (need Paw\'s Paradise Hostel, Posh Paws Spa, K9 Academy Nepal). Run: npm run seed:services'
    );
  }

  const roomId = makeVetDirectRoomId(testUser._id, vet._id);
  await VetDirectMessage.insertMany([
    {
      roomId,
      ownerUser: testUser._id,
      vetUser: vet._id,
      sender: vet._id,
      text: "Namaste! This is a follow-up on Max's recent visit. Please let me know if you notice any itching again.",
    },
    {
      roomId,
      ownerUser: testUser._id,
      vetUser: vet._id,
      sender: testUser._id,
      text: 'Thank you, doctor — Max has been comfortable and the shampoo helped a lot.',
    },
  ]);
  // eslint-disable-next-line no-console
  console.log('[SEEDER] Vet direct messages added (follow-up thread).');

  return pet;
}

async function run() {
  await connectDB();

  await ensureCustomerCareAdmin();
  const vet = await ensureVet();
  const rider = await ensureRider();
  const testUser = await upsertMasterUser();
  await seedPetAndHistory({ testUser, vet, rider });

  // eslint-disable-next-line no-console
  console.log(
    "[SUCCESS] Master User 'testuser@pawsewa.com' created with full ecosystem history."
  );
  // eslint-disable-next-line no-console
  console.log('[SEEDER] Login: email=', TEST_EMAIL, '| password=', TEST_PASSWORD);
  // eslint-disable-next-line no-console
  console.log(
    '[SEEDER] Customer Care admin _id (CUSTOMER_CARE_ADMIN_ID):',
    CARE_ADMIN_ID_STR
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[SEEDER] masterUserSeeder failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
