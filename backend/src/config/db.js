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
    // Replace database name in URI: .../CurrentDB?... or .../CurrentDB
    uri = uri.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`);
  }
  return uri;
}

const connectDB = async () => {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, {
      tls: uri.startsWith('mongodb+srv'),
      tlsAllowInvalidCertificates: true,
    });
    const connectedDb = mongoose.connection.db?.databaseName || 'unknown';
    logger.success('Connected to Database:', connectedDb);
  } catch (error) {
    logger.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
