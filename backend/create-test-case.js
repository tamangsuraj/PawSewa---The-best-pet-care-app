const mongoose = require('mongoose');
require('dotenv').config();
const { getConnectionUri, getMongooseConnectionOptions } = require('./src/config/db');
const Case = require('./src/models/Case');
const User = require('./src/models/User');
const Pet = require('./src/models/Pet');

async function createTestCase() {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, getMongooseConnectionOptions(uri));

    console.log('Connected to MongoDB');

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

    console.log('✅ Test case created successfully!');
    console.log('Case ID:', testCase._id);
    console.log('Customer:', customer.name);
    console.log('Pet:', pet.name);
    console.log('Status:', testCase.status);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestCase();
