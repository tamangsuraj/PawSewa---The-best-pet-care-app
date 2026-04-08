/**
 * Script to create an admin user. Uses same DB as server (MONGO_URI + DB_NAME).
 * Run from backend: node scripts/createAdmin.js
 */

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');
const User = require('../src/models/User');

const createAdmin = async () => {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, getMongooseConnectionOptions(uri));
    console.log('[SUCCESS] Connected to MongoDB:', mongoose.connection.db?.databaseName || 'unknown');

    const anyAdmin = await User.findOne({
      $or: [
        { role: 'admin' },
        { role: 'ADMIN' },
        { role: 'Admin' },
        { role: { $regex: /^admin$/i } },
      ],
    })
      .select('email name role')
      .lean();

    if (anyAdmin) {
      console.log('[INFO] Admin user already exists.');
      console.log('[INFO] Email:', anyAdmin.email);
      console.log('[INFO] Name:', anyAdmin.name);
      console.log('[INFO] Role:', anyAdmin.role);
      console.log('[INFO] Next step: npm run sync:customer-care-admin (writes CUSTOMER_CARE_ADMIN_ID to .env)');
      process.exit(0);
    }

    const existingEmail = await User.findOne({ email: 'admin@pawsewa.com' });
    if (existingEmail) {
      console.log('[WARN] admin@pawsewa.com exists but role is not admin. Update role in DB or use another admin account.');
      process.exit(1);
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@pawsewa.com',
      password: 'admin123',
      role: 'admin',
      phone: '+1234567890',
    });

    console.log('[SUCCESS] Admin user created.');
    console.log('[INFO] Email:', admin.email);
    console.log('[INFO] Password: admin123');
    console.log('[INFO] Name:', admin.name);
    console.log('[INFO] Role:', admin.role);
    console.log('[INFO] Admin panel: http://localhost:3002');

    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Admin creation failed:', error.message);
    process.exit(1);
  }
};

createAdmin();
