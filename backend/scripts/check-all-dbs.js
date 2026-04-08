/**
 * Scan every logical database on the cluster for documents whose `name` matches a pet
 * (default: "Spoidy", case-insensitive). Use this to find "ghost" data outside pawsewa_chat.
 *
 * Run from backend (requires DB_NAME + MONGO_URI in .env):
 *   node scripts/check-all-dbs.js
 *
 * Custom name:
 *   PET_TRACE_NAME=Spoidy node scripts/check-all-dbs.js
 */

require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const {
  getConnectionUri,
  getMongooseConnectionOptions,
  getConfiguredDbName,
  withExplicitDatabasePathInUri,
} = require('../src/config/db');

const TRACE = (process.env.PET_TRACE_NAME || 'Spoidy').trim();
const SKIP_DBS = new Set(['admin', 'local', 'config']);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function run() {
  const rawUri = getConnectionUri();
  const logicalDb = getConfiguredDbName();
  const uri = withExplicitDatabasePathInUri(rawUri, logicalDb);

  console.log('[INFO] MongoDB: connecting with DB_NAME', logicalDb);
  await mongoose.connect(uri, getMongooseConnectionOptions(rawUri));

  console.log('[INFO] MongoDB: live database identified', mongoose.connection.name);
  console.log('[INFO] MongoDB: host', mongoose.connection.host);
  console.log('[INFO] Scan: matching name', JSON.stringify(TRACE));

  const client = mongoose.connection.getClient();
  const { databases } = await client.db().admin().listDatabases();

  const regex = new RegExp(`^${escapeRegex(TRACE)}$`, 'i');
  let foundCount = 0;

  for (const { name: dbName } of databases) {
    if (SKIP_DBS.has(dbName)) {
      continue;
    }
    const db = client.db(dbName);
    let collections;
    try {
      collections = await db.listCollections().toArray();
    } catch (e) {
      console.warn(`(skip listCollections) ${dbName}:`, e.message);
      continue;
    }

    for (const { name: collName } of collections) {
      try {
        const doc = await db.collection(collName).findOne({ name: regex });
        if (doc) {
          foundCount += 1;
          console.log('FOUND →', `database: "${dbName}"`, '|', `collection: "${collName}"`);
          console.log('       _id:', String(doc._id));
          console.log('       name:', doc.name);
          if (doc.pawId) {
            console.log('       pawId:', doc.pawId);
          }
          if (doc.owner) {
            console.log('       owner:', String(doc.owner));
          }
          console.log('');
        }
      } catch (e) {
        console.warn(`Query error ${dbName}.${collName}:`, e.message);
      }
    }
  }

  console.log('---');
  console.log('Matches:', foundCount);
  console.log('App target DB_NAME:', logicalDb);
  if (logicalDb !== 'pawsewa_chat') {
    console.warn('[WARN] DB_NAME is not pawsewa_chat. Align .env with Compass and clients.');
  }
  if (foundCount === 0) {
    console.log('No documents with that exact name (case-insensitive) in scanned databases.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
