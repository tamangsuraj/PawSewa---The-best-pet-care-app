/**
 * Script to backfill PawIDs for existing pets.
 * Run: node scripts/generatePawIds.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Pet = require('../src/models/Pet');

async function generatePawIdsForExistingPets() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const withoutPawId = await Pet.find({ $or: [{ pawId: { $exists: false } }, { pawId: null }] });
    console.log(`Found ${withoutPawId.length} pets without PawID`);

    for (const pet of withoutPawId) {
      // Saving will trigger the pre-save hook which assigns a unique pawId.
      await pet.save();
      console.log(`✓ Assigned PawID ${pet.pawId} to pet ${pet._id.toString()}`);
    }

    console.log('🎉 PawID backfill complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error generating PawIDs:', err.message || err);
    process.exit(1);
  }
}

generatePawIdsForExistingPets();

