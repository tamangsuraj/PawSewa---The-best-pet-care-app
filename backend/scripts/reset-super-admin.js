/**
 * Reset password for one user (bcrypt via User model save hook).
 * Uses the same DB as the server (MONGO_URI + DB_NAME).
 *
 * Run from backend:
 *   npm run reset:admin-password
 *   EMAIL=you@example.com NEW_PASSWORD=YourPass node scripts/reset-super-admin.js
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

const TARGET_EMAIL = (process.env.EMAIL || 'admin@pawsewa.com').toLowerCase().trim();
const NEW_PASSWORD = process.env.NEW_PASSWORD || 'admin123';

async function run() {
  const uri = getConnectionUri();
  log('INFO', 'Connecting to MongoDB...');

  await mongoose.connect(uri, getMongooseConnectionOptions(uri));

  log('SUCCESS', 'Connected to:', mongoose.connection.db?.databaseName || 'unknown');

  if (!NEW_PASSWORD || String(NEW_PASSWORD).length < 6) {
    log('ERROR', 'NEW_PASSWORD must be at least 6 characters.');
    process.exit(1);
  }

  const user = await User.findOne({ email: TARGET_EMAIL });
  if (!user) {
    log('ERROR', 'User not found for email:', TARGET_EMAIL);
    log('INFO', 'Create admin first: node scripts/createAdmin.js');
    process.exit(1);
  }

  user.password = NEW_PASSWORD;
  await user.save();
  if (String(user.role).toLowerCase() !== 'admin') {
    log(
      'WARN',
      'User role is',
      user.role,
      '— the admin web app only accepts role admin. Update role in DB if needed.'
    );
  }

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
