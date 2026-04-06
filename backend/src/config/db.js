const mongoose = require('mongoose');
const logger = require('../utils/logger');

const EXPECTED_DB_NAME = 'pawsewa_core';

/** High-visibility boot line (requested for debugging split-brain / wrong DB). */
mongoose.connection.on('open', () => {
  console.log('🚀 LIVE DB IDENTIFIED:', mongoose.connection.name);
  console.log('📍 HOST:', mongoose.connection.host);
});

mongoose.connection.on('open', async () => {
  try {
    const conn = mongoose.connection;
    const host = conn.host || '(unknown)';
    const dbName = conn.name || conn.db?.databaseName || '(unknown)';
    const cols = await conn.db.listCollections().toArray();
    const collectionNames = cols.map((c) => c.name).sort();

    console.log('[MongoDB] Connection open');
    console.log('[MongoDB] Host:', host);
    console.log('[MongoDB] Database name:', dbName);
    console.log(`[MongoDB] Collections (${collectionNames.length}):`, collectionNames.join(', '));

    if (conn.name !== EXPECTED_DB_NAME) {
      console.warn(`⚠️ WARNING: You are not connected to ${EXPECTED_DB_NAME}!`);
    }
  } catch (err) {
    console.error('[MongoDB] open listener error:', err.message);
  }
});

function getConfiguredDbName() {
  // STRICT POLICY: One logical database only.
  // If unset or different, pin it to pawsewa_core automatically.
  const n = (process.env.DB_NAME || '').trim();
  if (!n || n !== EXPECTED_DB_NAME) {
    process.env.DB_NAME = EXPECTED_DB_NAME;
    return EXPECTED_DB_NAME;
  }
  return n;
}

/**
 * Base MongoDB connection string from env (cluster / host). May omit a database path.
 */
function getConnectionUri() {
  /**
   * STRICT POLICY: Always use MongoDB Atlas Pawsewa-Cluster. Do not use local MongoDB for development or production.
   */
  const uri = (process.env.MONGO_URI || '').trim();
  if (!uri) {
    throw new Error(
      'MONGO_URI is required in backend/.env and must be the Atlas SRV string (mongodb+srv://...). Local MongoDB is forbidden.',
    );
  }
  const lower = uri.toLowerCase();
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) {
    // ANSI red high-visibility fatal line.
    // eslint-disable-next-line no-console
    console.error(
      '\x1b[31m[FATAL ERROR]: LOCAL DATABASE DETECTED. SYSTEM HALTED. ONLY MONGODB ATLAS PAWSEWA-CLUSTER IS PERMITTED.\x1b[0m'
    );
    throw new Error('Local MongoDB detected in MONGO_URI.');
  }
  if (!uri.startsWith('mongodb+srv://')) {
    throw new Error(
      `MONGO_URI must be a mongodb+srv:// Atlas URI. Refusing to start with: ${uri.slice(0, 32)}...`,
    );
  }
  return uri;
}

/**
 * Ensures the URI contains an explicit database path using DB_NAME when the URI has no
 * path (or only a trailing slash). Prevents drivers/tools from assuming `test`.
 * If the URI path disagrees with DB_NAME, we warn; Mongoose still uses `dbName` option.
 */
function withExplicitDatabasePathInUri(rawUri, logicalDbName) {
  const qIndex = rawUri.indexOf('?');
  const query = qIndex >= 0 ? rawUri.slice(qIndex) : '';
  const left = qIndex >= 0 ? rawUri.slice(0, qIndex) : rawUri;
  const hostSlashMatch = left.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(\/?.*)?$/i);
  if (!hostSlashMatch) {
    return rawUri;
  }
  const afterHost = hostSlashMatch[2] || '';
  const pathOnly = afterHost.replace(/^\//, '').split('/')[0];
  if (!pathOnly) {
    const base = left.replace(/\/$/, '');
    return `${base}/${logicalDbName}${query}`;
  }
  if (pathOnly !== logicalDbName) {
    console.warn(
      `[MongoDB] MONGO_URI database path "${pathOnly}" differs from DB_NAME "${logicalDbName}". Using DB_NAME via Mongoose dbName option.`,
    );
  }
  return rawUri;
}

/**
 * Options for mongoose.connect(uri, opts). Always sets dbName so data never lands in `test` by accident.
 */
function getMongooseConnectionOptions(uri) {
  return {
    dbName: getConfiguredDbName(),
    tls: uri.startsWith('mongodb+srv'),
    tlsAllowInvalidCertificates: true,
  };
}

const connectDB = async (retries = 3) => {
  const rawUri = getConnectionUri();
  const logicalDb = getConfiguredDbName();
  const uri = withExplicitDatabasePathInUri(rawUri, logicalDb);
  const opts = getMongooseConnectionOptions(rawUri);
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, opts);
      const connectedDb = mongoose.connection.db?.databaseName || 'unknown';
      console.log(
        `[DB STATUS] Connected to: ${mongoose.connection.name} at ${mongoose.connection.host}`,
      );
      logger.success('System connected to:', connectedDb);
      return connectedDb;
    } catch (error) {
      logger.error(`MongoDB connection failed (attempt ${attempt}/${retries}):`, error.message);
      if (attempt === retries) {
        logger.error('Cannot connect to database. Check MONGO_URI and DB_NAME in .env.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
};

module.exports = connectDB;
module.exports.getConnectionUri = getConnectionUri;
module.exports.withExplicitDatabasePathInUri = withExplicitDatabasePathInUri;
module.exports.getConfiguredDbName = getConfiguredDbName;
module.exports.getMongooseConnectionOptions = getMongooseConnectionOptions;
