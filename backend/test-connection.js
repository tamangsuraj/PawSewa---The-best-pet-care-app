require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');
console.log('MONGO_URI:', process.env.MONGO_URI.replace(/:[^:@]+@/, ':****@'));

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('✅ SUCCESS! Database connected!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ FAILED! Error:', error.message);
    console.log('Full error:', error);
    process.exit(1);
  });
