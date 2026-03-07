/**
 * Database and collection audit script.
 * Lists all databases, their collections, document counts, and samples pawsewa_production users.
 * Run from backend: node scripts/check-db.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function log(level, ...args) {
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log(`[${ts()}] [${level}] ${msg}`);
}

function getBaseUri() {
  let uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pawsewa_dev';
  const dbName = process.env.DB_NAME;
  if (dbName) {
    uri = uri.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`);
  }
  return uri;
}

async function run() {
  const uri = getBaseUri();
  log('INFO', 'Connecting to MongoDB...');

  await mongoose.connect(uri, {
    tls: uri.startsWith('mongodb+srv'),
    tlsAllowInvalidCertificates: true,
  });

  log('SUCCESS', 'Connected.');

  const client = mongoose.connection.getClient();
  const admin = client.db().admin();
  const { databases } = await admin.listDatabases();

  log('INFO', '--- Database list ---');
  const dbNames = databases.map((d) => d.name).sort();
  for (const name of dbNames) {
    log('INFO', 'DB:', name);
  }
  log('INFO', '--- End database list ---');

  const databasesFound = [];

  for (const { name: dbName } of databases) {
    databasesFound.push(dbName);
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const collNames = collections.map((c) => c.name);

    for (const collName of collNames.sort()) {
      try {
        const count = await db.collection(collName).countDocuments();
        log('INFO', `DB: ${dbName} | Collection: ${collName} | Count: ${count}`);
      } catch (e) {
        log('INFO', `DB: ${dbName} | Collection: ${collName} | Count: (error: ${e.message})`);
      }
    }
  }

  if (dbNames.includes('pawsewa_production')) {
    const prodDb = client.db('pawsewa_production');
    const usersColl = prodDb.collection('users');
    const sample = await usersColl.findOne({});
    log('INFO', '--- Sample user document (pawsewa_production.users) ---');
    if (sample) {
      const roleInfo = sample.role !== undefined ? `role: ${JSON.stringify(sample.role)}` : 'role: (not present)';
      log('INFO', roleInfo);
      log('INFO', 'Sample document keys:', Object.keys(sample).join(', '));
      log('INFO', 'Sample (sanitized):', JSON.stringify({
        _id: sample._id,
        name: sample.name,
        email: sample.email,
        role: sample.role,
        phone: sample.phone,
      }, null, 2));
    } else {
      log('INFO', 'No documents in users collection.');
    }
    log('INFO', '--- End sample ---');

    log('INFO', '--- Credential audit (pawsewa_production.users) ---');
    const users = await usersColl.find({}).project({ email: 1, password: 1, name: 1 }).toArray();
    for (const u of users) {
      const pw = u.password == null ? '(none)' : String(u.password);
      const isHashed = pw.startsWith('$2a$') || pw.startsWith('$2b$') || pw.startsWith('$2y$');
      const trunc = pw.length > 40 ? pw.substring(0, 40) + '...' : pw;
      log('INFO', `email: ${u.email || '(missing)'} | password: ${trunc} | style: ${isHashed ? 'hashed' : 'plain'}`);
    }
    log('INFO', '--- End credential audit ---');
  } else {
    log('INFO', 'pawsewa_production not found; skipping users sample.');
  }

  await mongoose.disconnect();
  log('SUCCESS', 'Disconnected.');

  log('INFO', '--- Summary: databases on this system ---');
  dbNames.forEach((n) => log('INFO', n));
  log('INFO', '--- End summary ---');
}

run().catch((e) => {
  log('ERROR', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
