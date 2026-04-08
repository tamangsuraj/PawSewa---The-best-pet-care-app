/**
 * Script to backfill PawIDs for existing pets.
 * Run: node scripts/generatePawIds.js
 */

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');
const Pet = require('../src/models/Pet');

async function generatePawIdsForExistingPets() {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, getMongooseConnectionOptions(uri));
    console.log('[INFO] MongoDB: connected.');

    const withoutPawId = await Pet.find({ $or: [{ pawId: { $exists: false } }, { pawId: null }] });
    console.log(`Found ${withoutPawId.length} pets without PawID`);

    for (const pet of withoutPawId) {
      // Saving will trigger the pre-save hook which assigns a unique pawId.
      await pet.save();
      console.log(`[INFO] PawID assigned: pawId=${pet.pawId} petId=${pet._id.toString()}`);
    }

    console.log('[SUCCESS] PawID backfill complete.');
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] PawID backfill failed:', err.message || err);
    process.exit(1);
  }
}

generatePawIdsForExistingPets();

