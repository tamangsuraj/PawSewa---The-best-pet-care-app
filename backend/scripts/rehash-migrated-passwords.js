/**
 * Re-hash passwords for users in pawsewa_production who have the migration
 * placeholder or need a known dev password. Use after migrate-products-cases-to-production
 * so migrated users (vets, riders, etc.) can log in.
 *
 * Usage:
 *   NEW_PASSWORD=YourSecurePassword node scripts/rehash-migrated-passwords.js
 *   (If NEW_PASSWORD is not set, script will not update any user.)
 *
 * Optional: EMAIL=one@example.com to update only that user.
 * Requires: backend/.env with MONGO_URI and DB_NAME=pawsewa_production.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MIGRATION_PLACEHOLDER = '$2a$10$migratedNoPasswordSetAdminMustResetPasswordReq';

function log(level, ...args) {
  const ts = new Date().toISOString();
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log(`[${ts}] [${level}] ${msg}`);
}

async function run() {
  const newPassword = process.env.NEW_PASSWORD;
  const singleEmail = process.env.EMAIL ? process.env.EMAIL.trim().toLowerCase() : null;

  if (!newPassword || newPassword.length < 6) {
    log('ERROR', 'Set NEW_PASSWORD (min 6 characters) in env to re-hash. Example: NEW_PASSWORD=dev123 node scripts/rehash-migrated-passwords.js');
    process.exit(1);
  }

  const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/';
  const dbName = process.env.DB_NAME || 'pawsewa_production';
  let uri = dbUri.replace(/\?.*$/, '');
  if (!uri.endsWith('/')) uri += '/';
  uri += dbName + (dbUri.includes('?') ? dbUri.slice(dbUri.indexOf('?')) : '');

  log('INFO', 'Connecting to', dbName, '...');
  await mongoose.connect(uri);

  const usersColl = mongoose.connection.collection('users');
  const filter = { email: { $exists: true, $ne: '' } };
  if (singleEmail) filter.email = singleEmail;
  else filter.$or = [
    { password: MIGRATION_PLACEHOLDER },
    { password: { $regex: /^\$2a\$10\$migrated/ } },
  ];

  const users = await usersColl.find(filter).toArray();
  log('INFO', 'Found', users.length, 'user(s) to update.');

  const hashed = await bcrypt.hash(newPassword, 10);
  let updated = 0;
  for (const u of users) {
    try {
      await usersColl.updateOne(
        { _id: u._id },
        { $set: { password: hashed, updatedAt: new Date() } }
      );
      updated++;
      log('INFO', 'Updated password for:', u.email);
    } catch (e) {
      log('ERROR', 'Update failed for', u.email, e.message);
    }
  }

  log('SUCCESS', 'Re-hash complete. Updated', updated, 'user(s).');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  log('ERROR', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
