const mongoose = require('mongoose');
const logger = require('../utils/logger');

const EXPECTED_DB_NAME = 'pawsewa_chat';

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
      console.warn('⚠️ WARNING: You are not connected to pawsewa_chat!');
    }
  } catch (err) {
    console.error('[MongoDB] open listener error:', err.message);
  }
});

/**
 * Active logical database name. Must be set in .env — no silent fallback (avoids split-brain vs Compass / other clients).
 */
function getConfiguredDbName() {
  const n = process.env.DB_NAME;
  if (n == null || String(n).trim() === '') {
    throw new Error(
      'DB_NAME is required in backend/.env (e.g. DB_NAME=pawsewa_chat). Set it explicitly; no default database name is applied.',
    );
  }
  return String(n).trim();
}

/**
 * Base MongoDB connection string from env (cluster / host). May omit a database path.
 */
function getConnectionUri() {
  return process.env.MONGO_URI || 'mongodb://localhost:27017';
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
  if (process.env.DB_NAME == null || String(process.env.DB_NAME).trim() === '') {
    console.error(
      '[DB STATUS] FATAL: DB_NAME is not set in .env. Refusing to start (prevents accidental use of MongoDB default database).',
    );
    process.exit(1);
  }

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
