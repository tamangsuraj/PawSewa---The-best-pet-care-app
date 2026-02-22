#!/usr/bin/env node
/**
 * Migration script: Consolidate data from SOURCE_DB into pawsewa_production.
 *
 * Usage:
 *   SOURCE_DB=pawsewa_chat npm run migrate:production
 *   SOURCE_DB=pawsewa_dev npm run migrate:production
 *   SOURCE_DB=petcare npm run migrate:production
 *
 * Environment:
 *   SOURCE_DB - Source database name (required, pass via terminal)
 *   MONGO_URI - Connection string base (e.g. mongodb://localhost:27017/)
 *   DB_NAME   - Destination database name (default: pawsewa_production)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const SOURCE_DB = process.env.SOURCE_DB;
const DB_NAME = process.env.DB_NAME || 'pawsewa_production';

if (!SOURCE_DB) {
  console.error('[ERROR] SOURCE_DB is required. Example: SOURCE_DB=pawsewa_chat npm run migrate:production');
  process.exit(1);
}

// Role mapping: old schema role -> unified role
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

// Default role based on source database when role is missing or unmapped
function getDefaultRole(sourceDb) {
  const db = (sourceDb || '').toLowerCase();
  if (db.includes('chat')) return 'CUSTOMER';
  if (db.includes('petcare')) return 'CUSTOMER';
  return 'CUSTOMER';
}

function parseMongoUri(uri) {
  const m = uri.match(/^(.+\/)([^/?]+)(\?.*)?$/);
  return m ? { base: m[1], db: m[2] } : { base: uri.replace(/\/?$/, '/'), db: null };
}

function log(level, msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`);
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/';
  const { base } = parseMongoUri(MONGO_URI.endsWith('/') ? MONGO_URI : MONGO_URI + '/');
  const sourceUri = base + SOURCE_DB;
  const targetUri = base + DB_NAME;

  log('INFO', `Source database: ${SOURCE_DB}`);
  log('INFO', `Destination database: ${DB_NAME}`);

  await mongoose.connect(sourceUri);
  const targetConn = await mongoose.createConnection(targetUri).asPromise();

  const User = require('../models/User');
  const Pet = require('../models/Pet');
  const Order = require('../models/Order');
  const UserUnified = require('../models/unified/UserUnified');
  const PetUnified = require('../models/unified/PetUnified');
  const OrderUnified = require('../models/unified/OrderUnified');

  const UserTarget = targetConn.model('UserUnified', UserUnified.schema, 'users');
  const PetTarget = targetConn.model('PetUnified', PetUnified.schema, 'pets');
  const OrderTarget = targetConn.model('OrderUnified', OrderUnified.schema, 'orders');

  try {
    // Users
    const users = await User.find().lean();
    log('INFO', `Migrating ${users.length} users from ${SOURCE_DB}...`);
    for (const u of users) {
      const role = ROLE_MAP[u.role] || getDefaultRole(SOURCE_DB);
      await UserTarget.findOneAndUpdate(
        { _id: u._id },
        {
          _id: u._id,
          name: u.name,
          email: u.email,
          password: u.password || '',
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
        },
        { upsert: true, new: true }
      );
    }
    log('INFO', `Migrated ${users.length} users.`);

    // Pets
    const pets = await Pet.find().lean();
    log('INFO', `Migrating ${pets.length} pets from ${SOURCE_DB}...`);
    let petCount = 0;
    for (const p of pets) {
      const ownerId = p.owner || p.ownerId;
      if (!ownerId) continue;
      await PetTarget.findOneAndUpdate(
        { _id: p._id },
        {
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
        },
        { upsert: true, new: true }
      );
      petCount++;
    }
    log('INFO', `Migrated ${petCount} pets.`);

    // Orders
    const orders = await Order.find().lean();
    log('INFO', `Migrating ${orders.length} orders from ${SOURCE_DB}...`);
    for (const o of orders) {
      const coords = o.deliveryLocation?.point?.coordinates || o.deliveryLocation?.coordinates || [0, 0];
      await OrderTarget.findOneAndUpdate(
        { _id: o._id },
        {
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
            coordinates: Array.isArray(coords) ? coords : [coords?.lng || 0, coords?.lat || 0],
          },
          status: o.status,
          assignedRiderId: o.assignedRider,
          deliveryNotes: o.deliveryNotes,
        },
        { upsert: true, new: true }
      );
    }
    log('INFO', `Migrated ${orders.length} orders.`);

    log('SUCCESS', `Migration completed for source: ${SOURCE_DB}`);
  } catch (err) {
    log('ERROR', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await targetConn.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
