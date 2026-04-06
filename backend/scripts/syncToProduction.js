#!/usr/bin/env node
/**
 * Sync source database into pawsewa_production by copying documents AS-IS
 * (legacy schema). Use this so the existing backend and app work against
 * pawsewa_production without code changes.
 *
 * Usage: SOURCE_DB=PawSewaDB node scripts/syncToProduction.js
 *
 * Environment: SOURCE_DB (required), MONGO_URI, DB_NAME (default: pawsewa_production)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const SOURCE_DB = process.env.SOURCE_DB;
const DB_NAME = process.env.DB_NAME || 'pawsewa_production';

if (!SOURCE_DB) {
  console.error('[ERROR] SOURCE_DB is required. Example: SOURCE_DB=PawSewaDB node scripts/syncToProduction.js');
  process.exit(1);
}

const COLLECTIONS_TO_SYNC = [
  'users',
  'pets',
  'orders',
  'products',
  'categories',
  'hostels',
  'carebookings',
  'cases',
  'servicerequests',
  'payments',
  'favourites',
  'reviews',
  'promocodes',
];

function parseMongoUri(uri) {
  const m = uri.match(/^(.+\/)([^/?]+)(\?.*)?$/);
  return m ? { base: m[1], db: m[2] } : { base: uri.replace(/\/?$/, '/'), db: null };
}

function log(level, msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`);
}

async function run() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI || !String(MONGO_URI).trim().startsWith('mongodb+srv://')) {
    console.error('[ERROR] MONGO_URI is required and must be the Atlas SRV string (mongodb+srv://...).');
    process.exit(1);
  }
  const { base } = parseMongoUri(MONGO_URI.endsWith('/') ? MONGO_URI : MONGO_URI + '/');
  const sourceUri = base + SOURCE_DB;
  const targetUri = base + DB_NAME;

  log('INFO', `Source: ${SOURCE_DB} -> Target: ${DB_NAME} (legacy schema preserved)`);

  await mongoose.connect(sourceUri);
  const targetConn = await mongoose.createConnection(targetUri).asPromise();
  const sourceDb = mongoose.connection.db;
  const targetDb = targetConn.db;

  try {
    for (const collName of COLLECTIONS_TO_SYNC) {
      try {
        const sourceColl = sourceDb.collection(collName);
        const targetColl = targetDb.collection(collName);
        const count = await sourceColl.countDocuments();
        if (count === 0) {
          log('INFO', `Skipping ${collName} (empty in source)`);
          continue;
        }
        const docs = await sourceColl.find({}).toArray();
        if (docs.length === 0) continue;

        await targetColl.deleteMany({});
        if (docs.length > 0) {
          await targetColl.insertMany(docs);
        }
        log('INFO', `Synced ${collName}: ${docs.length} documents`);
      } catch (err) {
        log('WARN', `Collection ${collName}: ${err.message}`);
      }
    }

    log('SUCCESS', `Sync completed. Backend can use DB_NAME=${DB_NAME} and app will see data.`);
  } catch (err) {
    log('ERROR', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await targetConn.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
