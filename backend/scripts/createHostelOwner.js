/**
 * Script to create a hostel owner user for testing
 * Run: node scripts/createHostelOwner.js
 */

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');
const User = require('../src/models/User');

const createHostelOwner = async () => {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, getMongooseConnectionOptions(uri));
    console.log('[INFO] MongoDB: connected.');

    const email = 'hostel@pawsewa.com';
    const existing = await User.findOne({ email });

    if (existing) {
      console.log('[INFO] Hostel owner already exists.');
      console.log('[INFO] Email:', existing.email);
      console.log('[INFO] Name:', existing.name);
      process.exit(0);
    }

    const owner = await User.create({
      name: 'Hostel Owner',
      email,
      password: 'hostel123',
      role: 'hostel_owner',
      phone: '+9779800000001',
    });

    console.log('[SUCCESS] Hostel owner created.');
    console.log('[INFO] Email:', owner.email);
    console.log('[INFO] Password: hostel123');
    console.log('[INFO] Name:', owner.name);
    console.log('[INFO] Role:', owner.role);
    console.log('[INFO] Next step: log in to the partner app, then subscribe to list your hostel.');

    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Hostel owner creation failed:', error.message);
    process.exit(1);
  }
};

createHostelOwner();
