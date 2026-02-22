#!/usr/bin/env node
/**
 * Migration script: Consolidate pawsewa_chat, pawsewa_dev, petcare
 * into a single pawsewa_production database.
 *
 * Usage:
 *   node scripts/migrate-to-pawsewa-production.js
 *
 * Environment:
 *   MONGO_URI - Connection string (e.g. mongodb://localhost:27017/pawsewa)
 *   SOURCE_DB - Source database name (default: from MONGO_URI)
 *   TARGET_DB - Target database name (default: pawsewa_production)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Role mapping: old -> new
const ROLE_MAP = {
  pet_owner: 'CUSTOMER',
  veterinarian: 'VET',
  admin: 'ADMIN',
  rider: 'RIDER',
  shop_owner: 'SERVICE_OWNER',
  care_service: 'SERVICE_OWNER',
  hostel_owner: 'SERVICE_OWNER',
  service_provider: 'SERVICE_OWNER',
  groomer: 'SERVICE_OWNER',
  trainer: 'SERVICE_OWNER',
  facility_owner: 'SERVICE_OWNER',
};

const HOSTEL_SERVICE_TYPE = {
  Hostel: 'hostel',
  Daycare: 'daycare',
  Grooming: 'grooming',
  Training: 'training',
  Wash: 'wash',
  Spa: 'spa',
};

const CARE_BOOKING_TYPE = {
  Hostel: 'hostel_stay',
  Daycare: 'hostel_stay',
  Grooming: 'grooming',
  Training: 'training',
  Wash: 'spa',
  Spa: 'spa',
};

function parseMongoUri(uri) {
  const m = uri.match(/^(.+\/)([^/?]+)(\?.*)?$/);
  return m ? { base: m[1], db: m[2] } : { base: uri.replace(/\/?$/, '/'), db: null };
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pawsewa';
  const TARGET_DB = process.env.TARGET_DB || 'pawsewa_production';
  const { base, db: defaultDb } = parseMongoUri(MONGO_URI);
  const SOURCE_DB = process.env.SOURCE_DB || defaultDb || 'pawsewa';

  const sourceUri = base + SOURCE_DB;
  const targetUri = base + TARGET_DB;

  console.log('[Migration] Source:', SOURCE_DB);
  console.log('[Migration] Target:', TARGET_DB);

  await mongoose.connect(sourceUri);
  const targetConn = await mongoose.createConnection(targetUri).asPromise();

  const User = require('../src/models/User');
  const Pet = require('../src/models/Pet');
  const Hostel = require('../src/models/Hostel');
  const Case = require('../src/models/Case');
  const ServiceRequest = require('../src/models/ServiceRequest');
  const CareBooking = require('../src/models/CareBooking');
  const Order = require('../src/models/Order');
  const ServiceRequestMessage = require('../src/models/ServiceRequestMessage');

  const UserUnified = require('../src/models/unified/UserUnified');
  const PetUnified = require('../src/models/unified/PetUnified');
  const ServiceUnified = require('../src/models/unified/ServiceUnified');
  const AppointmentUnified = require('../src/models/unified/AppointmentUnified');
  const OrderUnified = require('../src/models/unified/OrderUnified');
  const ChatMessageUnified = require('../src/models/unified/ChatMessageUnified');

  const UserTarget = targetConn.model('UserUnified', UserUnified.schema, 'users');
  const PetTarget = targetConn.model('PetUnified', PetUnified.schema, 'pets');
  const ServiceTarget = targetConn.model('ServiceUnified', ServiceUnified.schema, 'services');
  const AppointmentTarget = targetConn.model('AppointmentUnified', AppointmentUnified.schema, 'appointments');
  const OrderTarget = targetConn.model('OrderUnified', OrderUnified.schema, 'orders');
  const ChatTarget = targetConn.model('ChatMessageUnified', ChatMessageUnified.schema, 'chat_messages');

  try {

    await UserTarget.deleteMany({});
    await PetTarget.deleteMany({});
    await ServiceTarget.deleteMany({});
    await AppointmentTarget.deleteMany({});
    await OrderTarget.deleteMany({});
    await ChatTarget.deleteMany({});

    const users = await User.find().lean();
    for (const u of users) {
      const role = ROLE_MAP[u.role] || 'CUSTOMER';
      await UserTarget.create({
        _id: u._id,
        name: u.name,
        email: u.email,
        password: u.password,
        role,
        phone: u.phone,
        location: u.location,
        addresses: u.addresses || [],
        clinicName: u.clinicName,
        clinicLocation: u.clinicLocation,
        specialization: u.specialization || u.specialty,
        profilePicture: u.profilePicture,
        currentShift: u.currentShift || 'Off',
        isAvailable: u.isAvailable || false,
      });
    }
    console.log('[Migration] users:', users.length);

    const pets = await Pet.find().lean();
    for (const p of pets) {
      const ownerId = p.owner || p.ownerId;
      if (!ownerId) continue;
      await PetTarget.create({
        _id: p._id,
        ownerId,
        pawId: p.pawId,
        name: p.name,
        species: p.species,
        breed: p.breed,
        dob: p.dob,
        age: p.age,
        gender: p.gender,
        weight: p.weight,
        photoUrl: p.photoUrl || '',
        medicalConditions: p.medicalConditions,
        isVaccinated: p.isVaccinated || false,
        medicalHistory: p.medicalHistory || [],
        });
    }
    console.log('[Migration] pets:', pets.length);

    const hostels = await Hostel.find().lean();
    for (const h of hostels) {
      const type = HOSTEL_SERVICE_TYPE[h.serviceType] || 'hostel';
      await ServiceTarget.create({
        _id: h._id,
        providerId: h.ownerId,
        type,
        name: h.name,
        description: h.description,
        location: h.location,
        pricePerNight: h.pricePerNight,
        pricePerSession: h.pricePerSession,
        images: h.images || [],
        amenities: h.amenities || [],
        roomTypes: h.roomTypes || [],
        groomingPackages: h.groomingPackages || [],
        addOns: h.addOns || [],
        rating: h.rating || 0,
        reviewCount: h.reviewCount || 0,
        isVerified: h.isVerified || false,
        isActive: h.isActive || false,
      });
    }
    console.log('[Migration] services:', hostels.length);

    const cases = await Case.find().lean();
    for (const c of cases) {
      await AppointmentTarget.create({
        _id: c._id,
        type: 'vet_visit',
        customerId: c.customer,
        petId: c.pet,
        staffId: c.assignedVet,
        description: c.issueDescription,
        location: typeof c.location === 'string' ? { address: c.location } : c.location,
        status: c.status,
        notes: c.notes,
      });
    }

    const serviceRequests = await ServiceRequest.find().lean();
    for (const sr of serviceRequests) {
      await AppointmentTarget.create({
        type: 'vet_appointment',
        customerId: sr.user,
        petId: sr.pet,
        staffId: sr.assignedStaff,
        description: sr.notes,
        location: sr.location,
        preferredDate: sr.preferredDate,
        timeWindow: sr.timeWindow,
        totalAmount: sr.totalAmount,
        status: sr.status,
        paymentStatus: sr.paymentStatus || 'unpaid',
        visitNotes: sr.visitNotes,
      });
    }
    console.log('[Migration] appointments (cases):', cases.length, '(serviceRequests):', serviceRequests.length);

    const careBookings = await CareBooking.find().lean();
    for (const cb of careBookings) {
      const type = CARE_BOOKING_TYPE[cb.serviceType] || 'hostel_stay';
      await AppointmentTarget.create({
        type,
        customerId: cb.userId,
        petId: cb.petId,
        serviceId: cb.hostelId,
        checkIn: cb.checkIn,
        checkOut: cb.checkOut,
        roomType: cb.roomType,
        nights: cb.nights,
        totalAmount: cb.totalAmount,
        status: cb.status === 'accepted' ? 'assigned' : cb.status === 'completed' ? 'completed' : 'pending',
        paymentStatus: cb.paymentStatus || 'unpaid',
      });
    }
    console.log('[Migration] appointments (careBookings):', careBookings.length);

    const orders = await Order.find().lean();
    for (const o of orders) {
      const coords = o.deliveryLocation?.point?.coordinates || o.deliveryLocation?.coordinates || [0, 0];
      await OrderTarget.create({
        _id: o._id,
        userId: o.user,
        items: (o.items || []).map((i) => ({
          productId: i.product,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus || 'unpaid',
        paymentMethod: o.paymentMethod,
        deliveryLocation: {
          address: o.deliveryLocation?.address || '',
          coordinates: Array.isArray(coords) ? coords : [coords.lng || 0, coords.lat || 0],
        },
        status: o.status,
        assignedRiderId: o.assignedRider,
        deliveryNotes: o.deliveryNotes,
      });
    }
    console.log('[Migration] orders:', orders.length);

    const messages = await ServiceRequestMessage.find().lean();
    for (const m of messages) {
      const conversationId = m.serviceRequest?.toString() || m.serviceRequest;
      if (!conversationId) continue;
      await ChatTarget.create({
        conversationId,
        senderId: m.sender,
        content: m.content,
      });
    }
    console.log('[Migration] chat_messages:', messages.length);
  } catch (err) {
    console.error('[Migration] Error:', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await mongoose.disconnect();
    await targetConn.close();
  }

  console.log('[Migration] Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
