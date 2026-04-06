/**
 * Migrate products, categories, cases, users (vets, riders, etc.), promocodes,
 * pets, orders, payments, and other collections from PawSewaDB and petcare
 * into pawsewa_production. Run once after setting MONGO_URI and DB_NAME in .env.
 * Usage: node scripts/migrate-products-cases-to-production.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function log(level, ...args) {
  const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  console.log(`[${ts()}] [${level}] ${msg}`);
}

const STATUS_MAP = {
  OPEN: 'pending',
  PENDING: 'pending',
  pending: 'pending',
  assigned: 'assigned',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

function normalizeUserRole(r) {
  if (r == null) return 'pet_owner';
  const s = String(r).trim();
  if (['VET', 'veterinarian'].includes(s)) return 'veterinarian';
  if (['RIDER', 'rider', 'staff'].includes(s)) return 'rider';
  if (['ADMIN', 'admin'].includes(s)) return 'admin';
  if (['CUSTOMER', 'pet_owner', 'customer'].includes(s)) return 'pet_owner';
  if (['shop_owner', 'care_service', 'hostel_owner', 'service_provider', 'groomer', 'trainer', 'facility_owner'].includes(s)) return s;
  return s;
}

function normalizeCaseStatus(s) {
  if (s == null) return 'pending';
  const v = STATUS_MAP[String(s)] || String(s).toLowerCase();
  return STATUS_MAP[v] || 'pending';
}

function getBaseUri() {
  let uri = process.env.MONGO_URI;
  if (!uri || !String(uri).trim().startsWith('mongodb+srv://')) {
    throw new Error('MONGO_URI is required and must be the Atlas SRV string (mongodb+srv://...).');
  }
  if (uri.includes('?')) {
    uri = uri.replace(/\/[^/?]*\?/, '/?');
  } else {
    uri = uri.replace(/\/[^/]*$/, '/');
  }
  return uri;
}

async function run() {
  const baseUri = getBaseUri();
  log('INFO', 'Connecting to cluster...');
  const client = new MongoClient(baseUri, {
    tls: baseUri.startsWith('mongodb+srv'),
    tlsAllowInvalidCertificates: true,
  });
  await client.connect();

  const targetDb = client.db('pawsewa_production');
  const sourceDbs = ['PawSewaDB', 'petcare'];

  let totalProductsMigrated = 0;
  let totalCasesMigrated = 0;
  let totalUsersMigrated = 0;
  let totalPromocodesMigrated = 0;
  let totalPetsMigrated = 0;
  let totalOrdersMigrated = 0;
  let totalPaymentsMigrated = 0;
  let totalReviewsMigrated = 0;
  let totalFavouritesMigrated = 0;
  const seenCategoryIds = new Set();
  const seenUserIds = new Set();
  const seenPromoIds = new Set();
  const seenPetIds = new Set();
  const seenOrderIds = new Set();
  const seenPaymentIds = new Set();
  const seenReviewIds = new Set();
  const seenFavIds = new Set();
  const seenGeneric = new Map();

  for (const sourceDbName of sourceDbs) {
    const sourceDb = client.db(sourceDbName);
    const colls = await sourceDb.listCollections().toArray();
    const names = colls.map((c) => c.name);

    if (names.includes('categories')) {
      const categories = await sourceDb.collection('categories').find({}).toArray();
      const catColl = targetDb.collection('categories');
      for (const cat of categories) {
        if (seenCategoryIds.has(cat._id.toString())) continue;
        try {
          await catColl.updateOne(
            { _id: cat._id },
            { $setOnInsert: { name: cat.name || 'General', slug: cat.slug || (cat.name || 'general').toLowerCase().replace(/\s+/g, '-'), image: cat.image || '' } },
            { upsert: true }
          );
          seenCategoryIds.add(cat._id.toString());
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'Category upsert:', e.message);
        }
      }
      log('INFO', 'Categories from', sourceDbName, ':', categories.length);
    }

    const productCollNames = ['products', 'product'];
    for (const collName of productCollNames) {
      if (!names.includes(collName)) continue;
      const products = await sourceDb.collection(collName).find({}).toArray();
      const targetProd = targetDb.collection('products');
      for (const doc of products) {
        if (!doc.category) continue;
        try {
          await targetProd.updateOne(
            { _id: doc._id },
            {
              $setOnInsert: {
                name: doc.name || 'Product',
                description: doc.description || '',
                price: doc.price ?? 0,
                stockQuantity: doc.stockQuantity ?? 0,
                category: doc.category,
                images: Array.isArray(doc.images) ? doc.images : [],
                isAvailable: doc.isAvailable !== false,
                rating: doc.rating ?? 0,
                reviewCount: doc.reviewCount ?? 0,
                createdAt: doc.createdAt || new Date(),
                updatedAt: doc.updatedAt || new Date(),
              },
            },
            { upsert: true }
          );
          totalProductsMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'Product insert:', e.message);
        }
      }
      log('INFO', 'Products from', sourceDbName + '.' + collName, ':', products.length);
    }

    const caseCollNames = ['cases', 'case'];
    for (const collName of caseCollNames) {
      if (!names.includes(collName)) continue;
      const cases = await sourceDb.collection(collName).find({}).toArray();
      const targetCases = targetDb.collection('cases');
      for (const doc of cases) {
        try {
          const status = normalizeCaseStatus(doc.status);
          await targetCases.updateOne(
            { _id: doc._id },
            {
              $setOnInsert: {
                customer: doc.customer || doc.customerId,
                pet: doc.pet || doc.petId,
                issueDescription: doc.issueDescription || doc.description || 'No description',
                location: doc.location || '',
                status,
                assignedVet: doc.assignedVet || doc.assignedStaff || null,
                shift: doc.shift || null,
                assignedAt: doc.assignedAt || null,
                completedAt: doc.completedAt || null,
                notes: doc.notes || null,
                createdAt: doc.createdAt || new Date(),
                updatedAt: doc.updatedAt || new Date(),
              },
            },
            { upsert: true }
          );
          totalCasesMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'Case insert:', e.message);
        }
      }
      log('INFO', 'Cases from', sourceDbName + '.' + collName, ':', cases.length);
    }

    if (names.includes('servicerequests')) {
      const srs = await sourceDb.collection('servicerequests').find({}).toArray();
      const targetCases = targetDb.collection('cases');
      for (const doc of srs) {
        try {
          const status = normalizeCaseStatus(doc.status);
          const customerId = doc.customerId || doc.user || doc.customer;
          const petId = doc.petId || doc.pet;
          if (!customerId || !petId) continue;
          const caseDoc = {
            _id: doc._id,
            customer: customerId,
            pet: petId,
            issueDescription: doc.issueDescription || doc.description || doc.serviceType || 'Service request',
            location: doc.location || doc.address || '',
            status,
            assignedVet: doc.assignedStaff || doc.assignedVet || null,
            shift: doc.shift || null,
            assignedAt: doc.assignedAt || null,
            completedAt: doc.completedAt || null,
            notes: doc.notes || null,
            createdAt: doc.createdAt || new Date(),
            updatedAt: doc.updatedAt || new Date(),
          };
          await targetCases.updateOne(
            { _id: doc._id },
            { $setOnInsert: caseDoc },
            { upsert: true }
          );
          totalCasesMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'ServiceRequest as case:', e.message);
        }
      }
      log('INFO', 'ServiceRequests as cases from', sourceDbName, ':', srs.length);
    }

    if (names.includes('users')) {
      const users = await sourceDb.collection('users').find({}).toArray();
      const targetUsers = targetDb.collection('users');
      for (const doc of users) {
        if (seenUserIds.has(doc._id.toString())) continue;
        if (!doc.email) continue;
        try {
          const role = normalizeUserRole(doc.role);
          const update = {
            name: doc.name || doc.full_name || doc.email || 'User',
            email: (doc.email || '').toString().toLowerCase().trim(),
            password: doc.password || doc.hashedPassword || '$2a$10$migratedNoPasswordSetAdminMustResetPasswordReq',
            role,
            phone: doc.phone || doc.phoneNumber || '',
            location: doc.location || doc.address || '',
            clinicLocation: doc.clinicLocation || doc.clinic_address || '',
            specialization: doc.specialization || doc.speciality || '',
            specialty: doc.specialty || doc.specialization || doc.speciality || '',
            clinicName: doc.clinicName || doc.clinic_name || '',
            bio: doc.bio || '',
            clinicAddress: doc.clinicAddress || doc.clinic_address || '',
            profilePicture: doc.profilePicture || doc.avatar || doc.profile_picture || '',
            currentShift: doc.currentShift || doc.current_shift || 'Off',
            isAvailable: doc.isAvailable !== undefined ? !!doc.isAvailable : (doc.is_available !== undefined ? !!doc.is_available : false),
            vehicleType: doc.vehicleType || doc.vehicle_type || '',
            licenseNumber: doc.licenseNumber || doc.license_number || '',
            isVerified: doc.isVerified !== undefined ? !!doc.isVerified : (doc.is_verified !== undefined ? !!doc.is_verified : false),
            createdAt: doc.createdAt || new Date(),
            updatedAt: doc.updatedAt || new Date(),
          };
          if (doc.password) update.password = doc.password;
          else if (doc.hashedPassword) update.password = doc.hashedPassword;
          await targetUsers.updateOne(
            { _id: doc._id },
            { $setOnInsert: update },
            { upsert: true }
          );
          seenUserIds.add(doc._id.toString());
          totalUsersMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'User upsert:', e.message);
        }
      }
      log('INFO', 'Users from', sourceDbName + '.users', ':', users.length);
    }

    const promoCollNames = ['promocodes', 'promoCodes', 'promo_codes'];
    for (const collName of promoCollNames) {
      if (!names.includes(collName)) continue;
      const docs = await sourceDb.collection(collName).find({}).toArray();
      const targetColl = targetDb.collection('promocodes');
      for (const doc of docs) {
        if (seenPromoIds.has(doc._id.toString())) continue;
        try {
          const code = (doc.code || doc.promoCode || doc.name || '').toString().trim().toUpperCase();
          if (!code) continue;
          await targetColl.updateOne(
            { _id: doc._id },
            {
              $setOnInsert: {
                code,
                discountPercentage: doc.discountPercentage ?? doc.discount_percentage ?? doc.percentage ?? 0,
                minOrderAmount: doc.minOrderAmount ?? doc.min_order_amount ?? doc.minAmount ?? 0,
                maxDiscountAmount: doc.maxDiscountAmount ?? doc.max_discount_amount ?? doc.maxDiscount ?? null,
                expiryDate: doc.expiryDate || doc.expiry_date || doc.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                usageLimit: doc.usageLimit ?? doc.usage_limit ?? doc.limit ?? 999,
                usedCount: doc.usedCount ?? doc.used_count ?? 0,
                isActive: doc.isActive !== undefined ? !!doc.isActive : (doc.is_active !== undefined ? !!doc.is_active : true),
                createdAt: doc.createdAt || new Date(),
                updatedAt: doc.updatedAt || new Date(),
              },
            },
            { upsert: true }
          );
          seenPromoIds.add(doc._id.toString());
          totalPromocodesMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'PromoCode upsert:', e.message);
        }
      }
      log('INFO', 'Promocodes from', sourceDbName + '.' + collName, ':', docs.length);
    }

    if (names.includes('pets')) {
      const pets = await sourceDb.collection('pets').find({}).toArray();
      const targetColl = targetDb.collection('pets');
      for (const doc of pets) {
        if (seenPetIds.has(doc._id.toString())) continue;
        try {
          const ownerId = doc.owner || doc.ownerId || doc.userId || doc.user;
          if (!ownerId) continue;
          await targetColl.updateOne(
            { _id: doc._id },
            {
              $setOnInsert: {
                owner: ownerId,
                pawId: doc.pawId || doc.paw_id || doc.pawID || '',
                name: doc.name || 'Pet',
                species: doc.species || 'Other',
                breed: doc.breed || '',
                dob: doc.dob || doc.dateOfBirth || null,
                age: doc.age ?? null,
                gender: doc.gender || 'Male',
                weight: doc.weight ?? null,
                photoUrl: doc.photoUrl || doc.photo_url || doc.image || doc.imageUrl || '',
                cloudinaryPublicId: doc.cloudinaryPublicId || doc.cloudinary_public_id || '',
                medicalConditions: doc.medicalConditions || doc.medical_conditions || '',
                behavioralNotes: doc.behavioralNotes || doc.behavioral_notes || '',
                createdAt: doc.createdAt || new Date(),
                updatedAt: doc.updatedAt || new Date(),
              },
            },
            { upsert: true }
          );
          seenPetIds.add(doc._id.toString());
          totalPetsMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'Pet upsert:', e.message);
        }
      }
      log('INFO', 'Pets from', sourceDbName + '.pets', ':', pets.length);
    }

    if (names.includes('orders')) {
      const orders = await sourceDb.collection('orders').find({}).toArray();
      const targetColl = targetDb.collection('orders');
      for (const doc of orders) {
        if (seenOrderIds.has(doc._id.toString())) continue;
        try {
          const userId = doc.user || doc.userId || doc.customerId || doc.customer;
          if (!userId) continue;
          await targetColl.updateOne(
            { _id: doc._id },
            {
              $setOnInsert: {
                user: userId,
                items: Array.isArray(doc.items) ? doc.items : doc.orderItems || [],
                totalAmount: doc.totalAmount ?? doc.total_amount ?? doc.total ?? 0,
                paymentStatus: doc.paymentStatus || doc.payment_status || 'unpaid',
                paymentMethod: doc.paymentMethod || doc.payment_method || null,
                deliveryLocation: doc.deliveryLocation || doc.delivery_location || doc.shippingAddress || doc.address || {},
                status: doc.status || 'pending',
                assignedRider: doc.assignedRider || doc.assignedRiderId || doc.riderId || null,
                createdAt: doc.createdAt || new Date(),
                updatedAt: doc.updatedAt || new Date(),
              },
            },
            { upsert: true }
          );
          seenOrderIds.add(doc._id.toString());
          totalOrdersMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'Order upsert:', e.message);
        }
      }
      log('INFO', 'Orders from', sourceDbName + '.orders', ':', orders.length);
    }

    if (names.includes('payments')) {
      const payments = await sourceDb.collection('payments').find({}).toArray();
      const targetColl = targetDb.collection('payments');
      for (const doc of payments) {
        if (seenPaymentIds.has(doc._id.toString())) continue;
        try {
          await targetColl.updateOne(
            { _id: doc._id },
            { $setOnInsert: { ...doc, createdAt: doc.createdAt || new Date(), updatedAt: doc.updatedAt || new Date() } },
            { upsert: true }
          );
          seenPaymentIds.add(doc._id.toString());
          totalPaymentsMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'Payment upsert:', e.message);
        }
      }
      log('INFO', 'Payments from', sourceDbName + '.payments', ':', payments.length);
    }

    if (names.includes('reviews')) {
      const reviews = await sourceDb.collection('reviews').find({}).toArray();
      const targetColl = targetDb.collection('reviews');
      for (const doc of reviews) {
        if (seenReviewIds.has(doc._id.toString())) continue;
        try {
          await targetColl.updateOne(
            { _id: doc._id },
            { $setOnInsert: { ...doc, createdAt: doc.createdAt || new Date(), updatedAt: doc.updatedAt || new Date() } },
            { upsert: true }
          );
          seenReviewIds.add(doc._id.toString());
          totalReviewsMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'Review upsert:', e.message);
        }
      }
      log('INFO', 'Reviews from', sourceDbName + '.reviews', ':', reviews.length);
    }

    if (names.includes('favourites')) {
      const favourites = await sourceDb.collection('favourites').find({}).toArray();
      const targetColl = targetDb.collection('favourites');
      for (const doc of favourites) {
        const key = (doc.user || doc.userId) + '_' + (doc.product || doc.productId);
        if (seenFavIds.has(key)) continue;
        try {
          await targetColl.updateOne(
            { _id: doc._id },
            { $setOnInsert: { ...doc, createdAt: doc.createdAt || new Date(), updatedAt: doc.updatedAt || new Date() } },
            { upsert: true }
          );
          seenFavIds.add(key);
          totalFavouritesMigrated++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', 'Favourite upsert:', e.message);
        }
      }
      log('INFO', 'Favourites from', sourceDbName + '.favourites', ':', favourites.length);
    }

    const otherCollections = ['hostels', 'carebookings', 'servicerequests', 'paymentlogs', 'providerapplications', 'subscriptions', 'notifications', 'stafflocations', 'chats', 'carerequests', 'care_requests'];
    for (const collName of otherCollections) {
      if (!names.includes(collName)) continue;
      let seen = seenGeneric.get(collName);
      if (!seen) { seen = new Set(); seenGeneric.set(collName, seen); }
      const docs = await sourceDb.collection(collName).find({}).toArray();
      const targetColl = targetDb.collection(collName);
      let added = 0;
      for (const doc of docs) {
        if (!doc._id) continue;
        if (seen.has(doc._id.toString())) continue;
        try {
          await targetColl.updateOne(
            { _id: doc._id },
            { $setOnInsert: { ...doc, updatedAt: doc.updatedAt || new Date() } },
            { upsert: true }
          );
          seen.add(doc._id.toString());
          added++;
        } catch (e) {
          if (e.code !== 11000) log('ERROR', collName, 'doc', e.message);
        }
      }
      if (added > 0) log('INFO', collName, 'from', sourceDbName, ':', added);
    }
  }

  log('SUCCESS', 'Migration complete. Products:', totalProductsMigrated, 'Cases:', totalCasesMigrated, 'Users:', totalUsersMigrated, 'Promocodes:', totalPromocodesMigrated, 'Pets:', totalPetsMigrated, 'Orders:', totalOrdersMigrated, 'Payments:', totalPaymentsMigrated, 'Reviews:', totalReviewsMigrated, 'Favourites:', totalFavouritesMigrated);
  await client.close();
  process.exit(0);
}

run().catch((e) => {
  log('ERROR', e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
