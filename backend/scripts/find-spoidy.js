/**
 * Temporary: scan all databases on the cluster for a pet document with name "Spoidy"
 * in a collection named `pets`. Uses MONGO_URI only (no DB_NAME required).
 *
 * Run from backend: node scripts/find-spoidy.js
 * Remove this file when you no longer need it.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const PET_NAME = 'Spoidy';
const COLLECTION = 'pets';

/** Skip system DBs — Atlas often denies reads on `local` (avoids Unauthorized noise). */
const SKIP_DBS = new Set(['admin', 'local', 'config']);

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri || String(uri).trim() === '') {
    console.error('MONGO_URI is missing in backend/.env');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const { databases } = await client.db().admin().listDatabases();
    const hits = [];

    for (const { name: dbName } of databases) {
      if (SKIP_DBS.has(dbName)) continue;

      const db = client.db(dbName);
      const cols = await db.listCollections({ name: COLLECTION }).toArray();
      if (cols.length === 0) continue;

      const doc = await db.collection(COLLECTION).findOne({ name: PET_NAME });
      if (doc) {
        hits.push({ database: dbName, collection: COLLECTION, _id: String(doc._id) });
        console.log(
          `[FOUND] database="${dbName}" collection="${COLLECTION}" _id=${doc._id} name=${JSON.stringify(doc.name)}`,
        );
      }
    }

    if (hits.length === 0) {
      console.log(`No pet with name ${JSON.stringify(PET_NAME)} found in any "${COLLECTION}" collection.`);
    } else {
      console.log('--- Summary ---');
      hits.forEach((h) => console.log(JSON.stringify(h)));
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
