/**
 * Test MongoDB Atlas connection. Run after setting MONGO_URI in .env.
 * Usage: node scripts/test-mongo-connection.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;
if (!uri || uri.includes('YOUR_ATLAS_PASSWORD') || uri.includes('<db_password>')) {
  console.error('[ERROR] Set MONGO_URI in .env with your real Atlas password.');
  console.error('  1. Atlas → Database Access → your user (e.g. admin) → Edit');
  console.error('  2. Edit Password → set a new password → Copy');
  console.error('  3. In backend/.env set: MONGO_URI=mongodb+srv://admin:PASTE_PASSWORD_HERE@pawsewa-cluster.h9kzdwx.mongodb.net/?appName=Pawsewa-Cluster');
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(uri, {
      tls: true,
      tlsAllowInvalidCertificates: true,
    });
    const db = mongoose.connection.db?.databaseName || 'unknown';
    console.log('[SUCCESS] Connected to MongoDB. Database:', db);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[ERROR]', err.message);
    if (err.message.includes('bad auth')) {
      console.error('');
      console.error('  Fix: Atlas → Database Access → select your user → Edit → Edit Password');
      console.error('  Set a new password, then in .env set MONGO_URI=mongodb+srv://admin:NEW_PASSWORD@...');
      console.error('  If your username is not "admin", use that username in the URI instead.');
    }
    process.exit(1);
  }
}
run();
