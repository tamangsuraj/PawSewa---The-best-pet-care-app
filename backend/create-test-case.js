const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });
const { getConnectionUri } = require('./src/config/db');
const Case = require('./src/models/Case');
const User = require('./src/models/User');
const Pet = require('./src/models/Pet');

async function createTestCase() {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, {
      tls: uri.startsWith('mongodb+srv'),
      tlsAllowInvalidCertificates: true,
    });

    console.log('[INFO] MongoDB: connected.');

    // Get a customer and a pet
    const customer = await User.findOne({ role: 'pet_owner' });
    const pet = await Pet.findOne({ owner: customer._id });

    if (!customer || !pet) {
      console.error('No customer or pet found. Please run seed_demo.js first.');
      process.exit(1);
    }

    // Create a test case
    const testCase = await Case.create({
      customer: customer._id,
      pet: pet._id,
      issueDescription: 'Dog has a limp on left front leg',
      location: 'Kathmandu, Nepal',
      latitude: 27.7172,
      longitude: 85.3240,
      status: 'pending',
      type: 'assistance'
    });

    console.log('[SUCCESS] Test case created.');
    console.log('[INFO] Case ID:', testCase._id);
    console.log('[INFO] Customer:', customer.name);
    console.log('[INFO] Pet:', pet.name);
    console.log('[INFO] Status:', testCase.status);

    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Test case creation failed:', error.message);
    process.exit(1);
  }
}

createTestCase();
