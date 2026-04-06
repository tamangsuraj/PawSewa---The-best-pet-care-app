/**
 * Writes CUSTOMER_CARE_ADMIN_ID to backend/.env using the first admin user in the DB
 * (same resolution rules as customerCareService.resolveCareAdminId).
 *
 * Run from backend: npm run sync:customer-care-admin
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');
const { resolveCareAdminId } = require('../src/services/customerCareService');

async function run() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Missing backend/.env — create it from .env.example first.');
    process.exit(1);
  }

  const uri = getConnectionUri();
  await mongoose.connect(uri, getMongooseConnectionOptions(uri));

  const envLine = (process.env.CUSTOMER_CARE_ADMIN_ID || '').trim();
  if (envLine && mongoose.Types.ObjectId.isValid(envLine)) {
    const u = await User.findById(envLine).select('_id role').lean();
    if (!u || String(u.role || '').toLowerCase() !== 'admin') {
      console.warn(
        'CUSTOMER_CARE_ADMIN_ID in .env points to a missing or non-admin user; ignoring it for this sync.'
      );
      delete process.env.CUSTOMER_CARE_ADMIN_ID;
    }
  }

  const id = await resolveCareAdminId();
  await mongoose.disconnect();

  if (!id) {
    console.error('No admin user found. Create one with: node scripts/createAdmin.js');
    process.exit(1);
  }

  const line = `CUSTOMER_CARE_ADMIN_ID=${String(id)}`;
  let raw = fs.readFileSync(envPath, 'utf8');
  if (/^CUSTOMER_CARE_ADMIN_ID=/m.test(raw)) {
    raw = raw.replace(/^CUSTOMER_CARE_ADMIN_ID=.*$/m, line);
  } else {
    raw = `${raw.replace(/\s*$/, '')}\n${line}\n`;
  }
  fs.writeFileSync(envPath, raw, 'utf8');
  console.log('Updated backend/.env →', line);
  console.log('Restart the backend to pick up the change.');
}

run().catch((e) => {
  console.error(e.message || e);
  mongoose.disconnect().finally(() => process.exit(1));
});
