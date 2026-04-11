/**
 * Set login password for a user by email (bcrypt via User model).
 *
 * Usage:
 *   node scripts/set-user-password.js <email> <newPassword>
 *
 * Example (care centre demo):
 *   node scripts/set-user-password.js demo.care@pawsewa.chat "DemoPawSewa#2026"
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');
const User = require('../src/models/User');

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const newPassword = process.argv[3] || '';

  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/set-user-password.js <email> <newPassword>');
    process.exit(1);
  }
  if (!newPassword || newPassword.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  const uri = getConnectionUri();
  await mongoose.connect(uri, getMongooseConnectionOptions(uri));

  const user = await User.findOne({ email });
  if (!user) {
    console.error('No user found with email:', email);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.password = newPassword;
  user.isVerified = true;
  await user.save();

  console.log('[OK] Password updated for', email, '| role:', user.role);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
