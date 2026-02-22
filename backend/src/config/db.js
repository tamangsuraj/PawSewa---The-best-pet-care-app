const mongoose = require('mongoose');

const log = (level, msg) => {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] [${level}] ${msg}\n`);
};

function getConnectionUri() {
  let uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pawsewa';
  const dbName = process.env.DB_NAME || process.env.TARGET_DB;
  if (dbName) {
    uri = uri.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`);
  }
  return uri;
}

const connectDB = async () => {
  try {
    const uri = getConnectionUri();
    await mongoose.connect(uri, {
      tls: true,
      tlsAllowInvalidCertificates: true,
    });
    const dbName = mongoose.connection.db?.databaseName || 'pawsewa_db';
    log('INFO', `MongoDB connection established: ${dbName}`);
  } catch (error) {
    log('ERROR', `MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;