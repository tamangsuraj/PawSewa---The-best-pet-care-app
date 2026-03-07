/**
 * Script to create an admin user. Uses same DB as server (MONGO_URI + DB_NAME).
 * Run from backend: node scripts/createAdmin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getConnectionUri } = require('../src/config/db');
const User = require('../src/models/User');

const createAdmin = async () => {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, {
      tls: uri.startsWith('mongodb+srv'),
      tlsAllowInvalidCertificates: true,
    });
    console.log('[SUCCESS] Connected to MongoDB:', mongoose.connection.db?.databaseName || 'unknown');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@pawsewa.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('Email:', existingAdmin.email);
      console.log('Name:', existingAdmin.name);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@pawsewa.com',
      password: 'admin123',
      role: 'admin',
      phone: '+1234567890',
    });

    console.log('\n🎉 Admin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Password: admin123');
    console.log('👤 Name:', admin.name);
    console.log('🛡️  Role:', admin.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🚀 You can now login to the admin panel at:');
    console.log('   http://localhost:3002\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();
