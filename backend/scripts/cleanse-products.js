/**
 * Cleanses product data: removes gibberish titles, replaces unprofessional
 * images with standard placeholder. Run against pawsewa_production.
 * Usage: node scripts/cleanse-products.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getConnectionUri } = require('../src/config/db');
const Product = require('../src/models/Product');

function log(level, ...args) {
  const ts = new Date().toISOString();
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log(`[${ts}] [${level}] ${msg}`);
}

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800';

// Gibberish: short alphanumeric only, or known bad patterns
const GIBBERISH_PATTERNS = [
  /^[a-z0-9]{6,25}$/i,           // single word alphanumeric 6+ chars (e.g. kgxyodt8)
  /^[a-z0-9]+\s+[a-z0-9]+$/i,     // two tokens like "khcjg igx7"
];
const GIBBERISH_BLOCKLIST = [
  'khcjg igx7', 'kgxyodt8', 'iyd8td8td8', 'sdasdasd', 'asdf', 'test', 'qwerty',
];
// Normalize for blocklist check (lowercase, trim)
function isBlocklisted(name) {
  const n = (name || '').toLowerCase().trim();
  return GIBBERISH_BLOCKLIST.some((b) => n === b.toLowerCase() || n.startsWith(b.toLowerCase() + ' '));
}
function looksGibberish(name) {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (trimmed.length < 2) return true;
  if (isBlocklisted(trimmed)) return true;
  return GIBBERISH_PATTERNS.some((re) => re.test(trimmed));
}

function needsPlaceholderImage(images) {
  if (!Array.isArray(images) || images.length === 0) return true;
  const first = images[0];
  if (!first || typeof first !== 'string' || first.trim() === '') return true;
  if (!first.startsWith('http')) return true; // data URI or relative
  return false;
}

async function run() {
  const uri = getConnectionUri();
  log('INFO', 'Connecting to database...');
  await mongoose.connect(uri, {
    tls: uri.startsWith('mongodb+srv'),
    tlsAllowInvalidCertificates: true,
  });
  const dbName = mongoose.connection.db?.databaseName || 'unknown';
  log('INFO', 'Connected to', dbName);

  const all = await Product.find({}).lean();
  let deleted = 0;
  let imagesUpdated = 0;

  for (const p of all) {
    const name = p.name?.toString()?.trim() ?? '';
    if (looksGibberish(name)) {
      await Product.findByIdAndDelete(p._id);
      deleted++;
      log('INFO', 'Deleted gibberish product:', p._id.toString(), name || '(no name)');
      continue;
    }
    if (needsPlaceholderImage(p.images)) {
      await Product.findByIdAndUpdate(p._id, { $set: { images: [PLACEHOLDER_IMAGE] } });
      imagesUpdated++;
    }
  }

  await mongoose.disconnect();
  log('SUCCESS', 'Database Cleansing complete: Gibberish products removed.');
  log('INFO', 'Deleted', deleted, 'products; updated images for', imagesUpdated, 'products.');
  process.exit(0);
}

run().catch((e) => {
  log('ERROR', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
