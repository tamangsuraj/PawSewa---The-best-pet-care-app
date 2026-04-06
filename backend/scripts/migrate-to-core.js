/**
 * Migrate fragmented DBs into pawsewa_core (upsert by _id).
 *
 * Sources:
 * - pawsewa_chat
 * - pawsewa_dev
 * - petcare
 *
 * Destination:
 * - pawsewa_core
 *
 * Notes:
 * - Idempotent: safe to re-run (uses bulkWrite upserts).
 * - Does NOT delete source DBs/collections.
 *
 * Run: npm run migrate:core
 */
/* eslint-disable no-console */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { MongoClient } = require('mongodb');

const URI = process.env.MONGO_URI;
if (!URI) {
  // eslint-disable-next-line no-console
  console.error('[migrate:core] Missing MONGO_URI in backend/.env');
  process.exit(1);
}

const DEST_DB = 'pawsewa_core';
const SOURCES = ['pawsewa_chat', 'pawsewa_dev', 'petcare'];

/**
 * Collections to migrate. Keep explicit to avoid copying junk/system collections.
 * Add more if you want full parity.
 */
const COLLECTIONS = [
  'users',
  'pets',
  'categories',
  'products',
  'subscriptions',
  'hostels',
  'centers',
  'trainings',
  'orders',
  'cases',
  'servicerequests',
  'servicerequestmessages',
  'chats',
  'marketplaceconversations',
  'marketplacemessages',
  'vetdirectmessages',
  'notifications',
  'chatunreadstates',
  'callsessions',
];

function log(...args) {
  console.log('[migrate:core]', ...args);
}

async function listExistingCollections(db) {
  const cols = await db.listCollections().toArray();
  return new Set(cols.map((c) => c.name));
}

async function migrateCollection({ srcDb, destDb, name }) {
  const src = srcDb.collection(name);
  const dest = destDb.collection(name);

  const cursor = src.find({}, { projection: {} }).batchSize(500);
  let total = 0;
  let batch = [];

  async function flush() {
    if (batch.length === 0) return;
    const ops = batch.map((doc) => {
      // De-dupe for unique indexes in destination.
      // Avoid duplicate-key crashes on unique indexes when the destination
      // already has a doc with same unique field (common after re-seeding).
      if (name === 'users') {
        const email = typeof doc.email === 'string' ? doc.email.toLowerCase().trim() : null;
        if (email) {
          const { _id, ...rest } = doc;
          return {
            updateOne: {
              filter: { email },
              update: { $set: rest },
              upsert: true,
            },
          };
        }
      }
      if (name === 'categories') {
        const nm = typeof doc.name === 'string' ? doc.name.trim() : null;
        if (nm) {
          const { _id, ...rest } = doc;
          return {
            updateOne: {
              filter: { name: nm },
              update: { $set: rest },
              upsert: true,
            },
          };
        }
      }
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true,
        },
      };
    });
    await dest.bulkWrite(ops, { ordered: false });
    total += batch.length;
    batch = [];
  }

  // eslint-disable-next-line no-restricted-syntax
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= 500) {
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }
  }
  await flush();
  return total;
}

async function run() {
  const client = new MongoClient(URI, {
    tlsAllowInvalidCertificates: true,
    maxPoolSize: 8,
  });

  await client.connect();
  const destDb = client.db(DEST_DB);
  const destExisting = await listExistingCollections(destDb);

  log('Destination db:', DEST_DB);

  for (const sourceName of SOURCES) {
    const srcDb = client.db(sourceName);
    const srcExisting = await listExistingCollections(srcDb);
    const usable = COLLECTIONS.filter((c) => srcExisting.has(c));
    if (usable.length === 0) {
      log('Source has no known collections:', sourceName);
      continue;
    }
    log('Migrating from', sourceName, 'collections:', usable.join(', '));

    for (const colName of usable) {
      // eslint-disable-next-line no-await-in-loop
      const n = await migrateCollection({ srcDb, destDb, name: colName });
      if (!destExisting.has(colName)) destExisting.add(colName);
      log(`  ✓ ${colName}: upserted ${n}`);
    }
  }

  await client.close();
  log('Done.');
}

run().catch((e) => {
  console.error('[migrate:core] FAILED:', e?.message || e);
  process.exit(1);
});

