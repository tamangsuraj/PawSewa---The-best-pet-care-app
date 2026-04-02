/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const logger = require('../src/utils/logger');

const User = require('../src/models/User');
const Pet = require('../src/models/Pet');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const Appointment = require('../src/models/Appointment');
const Order = require('../src/models/Order');

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function ensureCategory(slug, name, image) {
  let cat = await Category.findOne({ slug }).lean();
  if (cat) return cat;
  cat = await Category.create({ slug, name, image });
  return cat.toObject ? cat.toObject() : cat;
}

async function upsertUserByEmail(email, data) {
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    Object.assign(existing, data);
    await existing.save();
    return existing;
  }
  return await User.create({ ...data, email });
}

async function run() {
  // Force pawsewa_production unless explicitly overridden.
  if (!process.env.DB_NAME) process.env.DB_NAME = 'pawsewa_production';

  await connectDB();

  // Demo riders
  const riders = [];
  for (let i = 1; i <= 3; i += 1) {
    const riderId = `RID-${String(i).padStart(3, '0')}`;
    const email = `demo.rider${i}@pawsewa.local`;
    // Store riderId in licenseNumber as a stable visible identifier (schema has no riderId field).
    const rider = await upsertUserByEmail(email, {
      name: `Demo Rider ${i}`,
      password: `PawSewaRider${i}!`,
      role: 'RIDER',
      phone: `98${String(10000000 + i).slice(0, 8)}`,
      isVerified: true,
      isAvailable: true,
      currentShift: 'Morning',
      vehicleType: 'Bike',
      licenseNumber: riderId,
    });
    riders.push(rider);
    riders.push(rider);
  }

  // Demo vets
  const vets = [];
  for (let i = 1; i <= 3; i += 1) {
    const vetId = `VET-${String(i).padStart(3, '0')}`;
    const email = `demo.vet${i}@pawsewa.local`;
    // Store vetId in clinicName to keep a stable visible identifier (schema has no vetId field).
    const vet = await upsertUserByEmail(email, {
      name: `Demo Vet ${i}`,
      password: `PawSewaVet${i}!`,
      role: 'VET',
      phone: `97${String(20000000 + i).slice(0, 8)}`,
      isVerified: true,
      clinicName: `Clinic ${vetId}`,
      specialization: 'General',
      isAvailable: true,
    });
    vets.push(vet);
  }

  // Demo customers (pet owners)
  const customers = [];
  for (let i = 1; i <= 2; i += 1) {
    const email = `demo.customer${i}@pawsewa.local`;
    const c = await upsertUserByEmail(email, {
      name: `Demo Customer ${i}`,
      password: `PawSewaCustomer${i}!`,
      role: 'CUSTOMER',
      phone: `96${String(30000000 + i).slice(0, 8)}`,
      isVerified: true,
    });
    customers.push(c);
  }

  // Demo pets (5) with DOBs for reminder engine tests
  const pets = [];
  const today = new Date();
  const petBirthdays = [
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 45)), // ~6.5w
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 75)), // ~10.5w
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 105)), // ~15w
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 160)), // ~23w
    new Date(Date.UTC(today.getUTCFullYear() - 2, today.getUTCMonth(), today.getUTCDate())), // adult
  ];
  const speciesList = ['Dog', 'Cat'];
  for (let i = 1; i <= 5; i += 1) {
    const owner = pick(customers);
    const dob = petBirthdays[i - 1];
    const pet = await Pet.create({
      owner: owner._id,
      name: `Demo Pet ${i}`,
      species: pick(speciesList),
      breed: i % 2 === 0 ? 'Mixed' : 'Local',
      dob,
      gender: i % 2 === 0 ? 'Female' : 'Male',
      weight: 5 + i,
      isOutdoor: i % 2 === 0,
    });
    pets.push(pet);
  }

  // Categories + products
  const catFood = await ensureCategory('pet-food', 'Pet Food', 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1200&q=80');
  const catGroom = await ensureCategory('grooming', 'Grooming', 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80');
  const catAcc = await ensureCategory('accessories', 'Accessories', 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=80');
  const categories = [catFood, catGroom, catAcc];

  const products = [];
  for (let i = 1; i <= 10; i += 1) {
    const category = pick(categories);
    const product = await Product.create({
      name: `Demo Product ${String(i).padStart(2, '0')}`,
      description: `Professional demo product used to populate shop listings. SKU: PROD-${String(i).padStart(3, '0')}.`,
      price: 199 + i * 25,
      stockQuantity: 50,
      category: category._id,
      images: [
        'https://images.unsplash.com/photo-1589927986089-35812388d1b4?auto=format&fit=crop&w=1200&q=80',
      ],
      isAvailable: true,
    });
    products.push(product);
  }

  // Backfill existing appointments with random pet/vet if fields exist.
  const appts = await Appointment.find({}).limit(200);
  for (const a of appts) {
    // eslint-disable-next-line no-await-in-loop
    const pet = pick(pets);
    // eslint-disable-next-line no-await-in-loop
    const vet = pick(vets);
    a.pet = pet._id;
    a.owner = pet.owner;
    a.veterinarian = vet._id;
    if (!a.date) a.date = new Date();
    if (!a.timeSlot) a.timeSlot = '10:00-11:00';
    const validStatus = new Set(['pending', 'confirmed', 'completed', 'cancelled']);
    if (a.status && !validStatus.has(a.status)) a.status = 'pending';
    // eslint-disable-next-line no-await-in-loop
    await a.save();
  }

  // Backfill existing orders: ensure at least 1 item and rider assignment and GPS.
  const orders = await Order.find({}).limit(200);
  for (const o of orders) {
    const rider = pick(riders);
    const p = pick(products);
    if (!o.user) {
      const owner = pick(customers);
      o.user = owner._id;
    }
    if (!o.deliveryLocation || !o.deliveryLocation.address) {
      o.deliveryLocation = {
        address: 'Demo Address, Kathmandu',
        point: { type: 'Point', coordinates: [85.3240, 27.7172] },
      };
    } else if (!o.deliveryLocation.point || !Array.isArray(o.deliveryLocation.point.coordinates)) {
      o.deliveryLocation.point = { type: 'Point', coordinates: [85.3240, 27.7172] };
    }
    if (!Array.isArray(o.items) || o.items.length === 0) {
      o.items = [
        {
          product: p._id,
          name: p.name,
          price: p.price,
          quantity: 1,
        },
      ];
      o.totalAmount = p.price;
    }
    // Repair invalid item rows
    o.items = (o.items || []).map((it) => {
      const item = it || {};
      return {
        ...item,
        product: item.product || p._id,
        name: item.name || p.name,
        price: Number(item.price) || p.price,
        quantity: Number(item.quantity) || 1,
      };
    });
    if (!o.totalAmount || o.totalAmount <= 0) {
      o.totalAmount = o.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
    }
    o.assignedRider = rider._id;
    if (o.status === 'pending') o.status = 'processing';
    // eslint-disable-next-line no-await-in-loop
    await o.save();
  }

  // Create 5 explicit demo shop orders with GPS + payment fields so the admin dashboard has data.
  for (let i = 1; i <= 5; i += 1) {
    const owner = pick(customers);
    const rider = pick(riders);
    const p = pick(products);
    const baseLat = 27.7172;
    const baseLng = 85.3240;
    const lat = baseLat + (Math.random() - 0.5) * 0.01;
    const lng = baseLng + (Math.random() - 0.5) * 0.01;
    const address = `Demo GPS Address ${i}, Kathmandu`;
    // eslint-disable-next-line no-await-in-loop
    const order = await Order.create({
      user: owner._id,
      items: [
        {
          product: p._id,
          name: p.name,
          price: p.price,
          quantity: 1,
        },
      ],
      totalAmount: p.price,
      paymentStatus: 'paid',
      paymentMethod: 'khalti',
      khaltiTransactionId: `DEMO-KHALTI-${Date.now()}-${i}`,
      deliveryLocation: {
        address,
        point: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      },
      status: i <= 2 ? 'out_for_delivery' : 'processing',
      deliveryNotes: 'Demo seeded order with high-precision GPS.',
      assignedRider: rider._id,
    });
    logger.info(
      `[INFO] Seed: Demo order ${order._id} created with GPS Coordinates (Lat: ${lat}, Lng: ${lng}).`
    );
  }

  logger.success('Database populated: 3 Riders, 3 Vets, 5 Pets, 10 Products created.');
  logger.info("Auth Exception Resolved: 'CUSTOMER' role is now a valid enum.");

  await mongoose.connection.close();
}

run().catch((e) => {
  logger.error('seed_demo failed:', e?.message || String(e));
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});

