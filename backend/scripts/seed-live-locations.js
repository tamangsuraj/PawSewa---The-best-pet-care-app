/**
 * Seed live_operations map pins: 5 pet shops, 5 care centers, 3 simulated riders, 3 simulated vets.
 * Run: node scripts/seed-live-locations.js (from backend/, with .env loaded)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { getConnectionUri, getMongooseConnectionOptions } = require('../src/config/db');
const LiveLocation = require('../src/models/LiveLocation');

const SEED = [
  // Pet shops (static)
  { key: 'seed-shop-thamel', category: 'pet_shop', name: 'Thamel Pet Supplies', lat: 27.7152, lng: 85.3125, detailPath: '/shops', isDynamic: false, status: 'active' },
  { key: 'seed-shop-jhamsikhel', category: 'pet_shop', name: 'Jhamsikhel Paw Mart', lat: 27.7221, lng: 85.3198, detailPath: '/shops', isDynamic: false, status: 'active' },
  { key: 'seed-shop-maharajgunj', category: 'pet_shop', name: 'Maharajgunj Animal Store', lat: 27.7378, lng: 85.3365, detailPath: '/shops', isDynamic: false, status: 'busy' },
  { key: 'seed-shop-boudha', category: 'pet_shop', name: 'Boudha Pet Corner', lat: 27.721, lng: 85.361, detailPath: '/shops', isDynamic: false, status: 'active' },
  { key: 'seed-shop-koteshwor', category: 'pet_shop', name: 'Koteshwor Feed & Care', lat: 27.6792, lng: 85.3452, detailPath: '/shops', isDynamic: false, status: 'active' },
  // Care centers (static)
  { key: 'seed-care-maharajgunj', category: 'care_center', name: 'Valley Vet Care Centre', lat: 27.7382, lng: 85.3372, detailPath: '/care/hostels', isDynamic: false, status: 'active' },
  { key: 'seed-care-thamel', category: 'care_center', name: 'Thamel Animal Clinic Hub', lat: 27.7148, lng: 85.3118, detailPath: '/care/service-providers', isDynamic: false, status: 'active' },
  { key: 'seed-care-patan', category: 'care_center', name: 'Patan Pet Hospital Campus', lat: 27.673, lng: 85.3235, detailPath: '/care/hostels', isDynamic: false, status: 'busy' },
  { key: 'seed-care-baneshwor', category: 'care_center', name: 'Baneshwor Grooming Hub', lat: 27.7058, lng: 85.3285, detailPath: '/care/bookings', isDynamic: false, status: 'active' },
  { key: 'seed-care-balu', category: 'care_center', name: 'Baluwatar Spa & Daycare', lat: 27.7262, lng: 85.3298, detailPath: '/care/bookings', isDynamic: false, status: 'active' },
  // Simulated riders (dynamic)
  { key: 'sim-rider-1', category: 'sim_rider', name: 'Rider — Prakash S.', lat: 27.701, lng: 85.318, detailPath: '/riders', isDynamic: true, status: 'active' },
  { key: 'sim-rider-2', category: 'sim_rider', name: 'Rider — Sita M.', lat: 27.728, lng: 85.335, detailPath: '/riders', isDynamic: true, status: 'busy' },
  { key: 'sim-rider-3', category: 'sim_rider', name: 'Rider — Bikash K.', lat: 27.688, lng: 85.332, detailPath: '/riders', isDynamic: true, status: 'active' },
  // Simulated vets (dynamic)
  { key: 'sim-vet-1', category: 'sim_vet', name: 'Dr. Anil Sharma (Field)', lat: 27.712, lng: 85.325, detailPath: '/veterinarians', isDynamic: true, status: 'active' },
  { key: 'sim-vet-2', category: 'sim_vet', name: 'Dr. Priya Gurung (Field)', lat: 27.735, lng: 85.34, detailPath: '/veterinarians', isDynamic: true, status: 'busy' },
  { key: 'sim-vet-3', category: 'sim_vet', name: 'Dr. Rohan Thapa (Field)', lat: 27.668, lng: 85.318, detailPath: '/veterinarians', isDynamic: true, status: 'active' },
];

async function run() {
  const uri = getConnectionUri();
  await mongoose.connect(uri, getMongooseConnectionOptions(uri));
  console.log('Connected. Seeding live_locations...');

  for (const row of SEED) {
    // eslint-disable-next-line no-await-in-loop
    await LiveLocation.findOneAndUpdate(
      { key: row.key },
      { $set: row },
      { upsert: true, new: true }
    );
  }

  const n = await LiveLocation.countDocuments();
  console.log(`Done. live_locations count: ${n}`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
