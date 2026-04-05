/**
 * Script to create a hostel owner user for testing
 * Run: node scripts/createHostelOwner.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');
const User = require('../src/models/User');

const createHostelOwner = async () => {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, getMongooseConnectionOptions(uri));
    console.log('✅ Connected to MongoDB');

    const email = 'hostel@pawsewa.com';
    const existing = await User.findOne({ email });

    if (existing) {
      console.log('⚠️  Hostel owner already exists!');
      console.log('Email:', existing.email);
      console.log('Name:', existing.name);
      process.exit(0);
    }

    const owner = await User.create({
      name: 'Hostel Owner',
      email,
      password: 'hostel123',
      role: 'hostel_owner',
      phone: '+9779800000001',
    });

    console.log('\n🎉 Hostel owner created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', owner.email);
    console.log('🔑 Password: hostel123');
    console.log('👤 Name:', owner.name);
    console.log('🛡️  Role:', owner.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🚀 Use these credentials to login to the Vet App (Partner App)');
    console.log('   Then subscribe to list your hostel.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createHostelOwner();
