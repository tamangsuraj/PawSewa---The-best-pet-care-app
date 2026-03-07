const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Resolve connection URI. If DB_NAME is set, use it as the database name
 * (overrides the database segment in MONGO_URI). Rollback: use pawsewa_dev,
 * not pawsewa_production.
 */
function getConnectionUri() {
  let uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pawsewa_dev';
  const dbName = process.env.DB_NAME;
  if (dbName) {
    // Inject or replace database name: ...host.net/DB?query or ...host.net/DB
    if (uri.includes('?')) {
      uri = uri.replace(/\/\?/, `/${dbName}?`);
    } else {
      uri = uri.replace(/\/?$/, `/${dbName}`);
    }
  }
  return uri;
}

const connectOptions = (uri) => ({
  tls: uri.startsWith('mongodb+srv'),
  tlsAllowInvalidCertificates: true,
});

const connectDB = async (retries = 3) => {
  const uri = getConnectionUri();
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, connectOptions(uri));
      const connectedDb = mongoose.connection.db?.databaseName || 'unknown';
      logger.success('System connected to:', connectedDb);
      return connectedDb;
    } catch (error) {
      logger.error(`MongoDB connection failed (attempt ${attempt}/${retries}):`, error.message);
      if (attempt === retries) {
        logger.error('Cannot connect to database. Check MONGO_URI and DB_NAME in .env and that MongoDB is running.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
};

module.exports = connectDB;
module.exports.getConnectionUri = getConnectionUri;
