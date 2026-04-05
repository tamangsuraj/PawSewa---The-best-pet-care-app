/**
 * Set a single user's password to admin123 (hashed) for admin login.
 * Uses the same DB as the server (MONGO_URI + DB_NAME).
 * Run from backend: node scripts/reset-super-admin.js
 * Optionally: EMAIL=suraj@example.com node scripts/reset-super-admin.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');
const User = require('../src/models/User');

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function log(level, ...args) {
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log(`[${ts()}] [${level}] ${msg}`);
}

const TARGET_EMAIL = process.env.EMAIL || 'suraj@example.com';
const NEW_PASSWORD = 'admin123';

async function run() {
  const uri = getConnectionUri();
  log('INFO', 'Connecting to MongoDB...');

  await mongoose.connect(uri, getMongooseConnectionOptions(uri));

  log('SUCCESS', 'Connected to:', mongoose.connection.db?.databaseName || 'unknown');

  const user = await User.findOne({ email: TARGET_EMAIL });
  if (!user) {
    log('ERROR', 'User not found for email:', TARGET_EMAIL);
    process.exit(1);
  }

  user.password = NEW_PASSWORD;
  await user.save();

  log('SUCCESS', 'Password updated for', TARGET_EMAIL, '(hashed). Use password:', NEW_PASSWORD);
  log('INFO', 'Authentication logic aligned with Database encryption style.');

  await mongoose.disconnect();
  log('SUCCESS', 'Disconnected.');
  process.exit(0);
}

run().catch((e) => {
  log('ERROR', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
