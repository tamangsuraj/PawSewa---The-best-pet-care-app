/**
 * Seed 50 performance-test customer accounts.
 * Run: node backend/tests/performance/seedPerfUsers.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const { getConnectionUri } = require('../../src/config/db');
const User = require('../../src/models/User');
async function main() {
  const uri = getConnectionUri();
  await mongoose.connect(uri);
  for (let i = 1; i <= 50; i += 1) {
    const n = String(i).padStart(2, '0');
    const email = `perf_user_${n}@test.com`;
    const exists = await User.findOne({ email });
    if (exists) continue;
    await User.create({
      name: `Perf User ${n}`,
      email,
      password: 'Test@123',
      role: 'pet_owner',
      isVerified: true,
    });
    console.log('Created', email);
  }
  console.log('Done.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
