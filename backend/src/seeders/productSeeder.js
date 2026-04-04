/**
 * Premium shop catalog: Unsplash imagery, targetPets (DOG/CAT), petTypes sync, ratings.
 * Clears all products, then inserts 20+ items. At least 5 DOG products use seller Pet Care+ Grooming.
 *
 * Run: npm run seed:products
 *
 * Env: uses backend/.env (DB_URI / MONGO_URI + DB_NAME).
 */
/* eslint-disable no-console */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');
const Category = require('../models/Category');
const User = require('../models/User');

const IMG = (photoPath) =>
  `https://images.unsplash.com/${photoPath}?auto=format&fit=crop&q=80&w=800`;

function petTypesFromTarget(targetPets) {
  if (!Array.isArray(targetPets) || targetPets.length === 0) return [];
  const out = [];
  if (targetPets.includes('DOG')) out.push('dog');
  if (targetPets.includes('CAT')) out.push('cat');
  if (targetPets.includes('RABBIT')) out.push('rabbit');
  return out;
}

async function ensureCategory(slug, name, image) {
  let cat = await Category.findOne({ slug });
  if (cat) return cat;
  cat = await Category.create({ slug, name, image });
  return cat;
}

async function ensureShopOwner({ email, name, facilityName }) {
  const em = email.toLowerCase().trim();
  let u = await User.findOne({ email: em });
  if (u) {
    if (u.role !== 'shop_owner') {
      u.role = 'shop_owner';
      u.name = name;
      if (facilityName) u.facilityName = facilityName;
      u.isVerified = true;
      await u.save();
    }
    return u;
  }
  return User.create({
    name,
    email: em,
    password: 'ShopSeed#2026',
    role: 'shop_owner',
    isVerified: true,
    phone: '9800000000',
    facilityName: facilityName || name,
  });
}

/**
 * Catalog rows: categorySlug must match ensured categories below.
 * sellerKey 'petcare' = Pet Care+ Grooming (5+ DOG items required).
 */
function buildProductDefs() {
  return [
    // —— Featured (reference SKUs) ——
    {
      name: 'Himalayan Yak Chews',
      description:
        'Premium Himalayan Yak Chews sourced from the high altitudes of Nepal. Long-lasting, protein-rich dental chew for medium and large dogs. No artificial preservatives.',
      price: 1290,
      stockQuantity: 120,
      categorySlug: 'pet-food',
      targetPets: ['DOG'],
      tags: ['Natural', 'Dental', 'Long-lasting', 'DOG'],
      badge: 'NATURAL',
      rating: 4.8,
      reviewCount: 156,
      image: IMG('photo-1589924691995-400dc9cec109'),
      sellerKey: 'petcare',
    },
    {
      name: 'Organic Salmon Kibble',
      description:
        'Cold-water salmon as the first ingredient, with omega fatty acids for skin and coat. Oven-baked small batch recipe crafted for discerning cats.',
      price: 3250,
      stockQuantity: 85,
      categorySlug: 'pet-food',
      targetPets: ['CAT'],
      tags: ['Organic', 'Omega-3', 'Grain-friendly', 'CAT'],
      badge: 'NATURAL',
      rating: 4.85,
      reviewCount: 521,
      image: IMG('photo-1514888286974-6c03e2ca1dba'),
      sellerKey: 'feline',
    },
    {
      name: 'NexGard Flea & Tick Chewables',
      description:
        'Vet-trusted monthly chewable for dogs that kills fleas and ticks before they bite. Beef-flavored and easy to dose; suitable for active outdoor companions.',
      price: 5200,
      stockQuantity: 64,
      categorySlug: 'health-wellness',
      targetPets: ['DOG'],
      tags: ['Parasite', 'Monthly', 'Prescription-style', 'DOG'],
      badge: 'HEALTH',
      rating: 4.7,
      reviewCount: 289,
      image: IMG('photo-1601758224634-281c0353bd1b'),
      sellerKey: 'petcare',
    },
    {
      name: 'Nordic Style Cat Scratcher',
      description:
        'Minimal Nordic-style sisal tower with stable weighted base. Satisfies scratching instincts and protects your furniture with a calm, design-forward silhouette.',
      price: 2100,
      stockQuantity: 42,
      categorySlug: 'toys-play',
      targetPets: ['CAT'],
      tags: ['Sisal', 'Furniture-saver', 'Modern', 'CAT'],
      badge: 'PLAY',
      rating: 4.75,
      reviewCount: 188,
      image: IMG('photo-1548546738-8509cb246ed3'),
      sellerKey: 'feline',
    },
    // —— Additional Pet Care+ Grooming (DOG) ——
    {
      name: 'Grain-Free Beef & Sweet Potato Kibble',
      description:
        'Single-source beef protein with sweet potato and peas for gentle digestion. Balanced for adult dogs with active lifestyles.',
      price: 2890,
      stockQuantity: 95,
      categorySlug: 'pet-food',
      targetPets: ['DOG'],
      tags: ['Grain-free', 'Beef', 'DOG'],
      badge: 'NATURAL',
      rating: 4.6,
      reviewCount: 412,
      image: IMG('photo-1568640347028-a61652865800'),
      sellerKey: 'petcare',
    },
    {
      name: 'Chicken Jerky Training Treats',
      description:
        'Thin-sliced real chicken jerky—high reward, low guilt. Ideal for recall training and positive reinforcement.',
      price: 650,
      stockQuantity: 200,
      categorySlug: 'pet-food',
      targetPets: ['DOG'],
      tags: ['Training', 'High-protein', 'DOG'],
      badge: 'NATURAL',
      rating: 4.55,
      reviewCount: 178,
      image: IMG('photo-1587300003388-59208cc962cb'),
      sellerKey: 'petcare',
    },
    {
      name: 'Reflective Rope Leash — 6 ft',
      description:
        'Marine-grade rope with woven reflective thread for dawn and dusk walks. Padded handle; corrosion-free hardware.',
      price: 890,
      stockQuantity: 150,
      categorySlug: 'collars-leashes',
      targetPets: ['DOG'],
      tags: ['Safety', 'Reflective', 'DOG'],
      badge: 'STYLE',
      rating: 4.45,
      reviewCount: 92,
      image: IMG('photo-1548199973-35812388d1b4'),
      sellerKey: 'petcare',
    },
    {
      name: 'Wild Alaskan Salmon Oil Pump',
      description:
        'Food-grade salmon oil with EPA and DHA to support joints, skin, and a glossy coat. Pump bottle for mess-free meals.',
      price: 1450,
      stockQuantity: 78,
      categorySlug: 'health-wellness',
      targetPets: ['DOG'],
      tags: ['Omega-3', 'Skin & coat', 'DOG'],
      badge: 'HEALTH',
      rating: 4.9,
      reviewCount: 203,
      image: IMG('photo-1583337130417-3346a1be7dee'),
      sellerKey: 'petcare',
    },
    {
      name: 'Ceramic Slow Feeder Bowl',
      description:
        'Maze-pattern ceramic bowl slows eating, reducing bloat risk. Heavy base resists tipping; dishwasher safe.',
      price: 1850,
      stockQuantity: 55,
      categorySlug: 'pet-supplies',
      targetPets: ['DOG'],
      tags: ['Digestion', 'Bloat-care', 'DOG'],
      badge: 'CARE',
      rating: 4.35,
      reviewCount: 67,
      image: IMG('photo-1535294435445-d7249524ef2e'),
      sellerKey: 'petcare',
    },
    {
      name: 'Puppy Gentle Hypoallergenic Shampoo',
      description:
        'Tearless coconut-based formula with oatmeal and aloe. pH-balanced for puppies and dogs with sensitive skin.',
      price: 720,
      stockQuantity: 110,
      categorySlug: 'health-wellness',
      targetPets: ['DOG'],
      tags: ['Grooming', 'Sensitive', 'DOG'],
      badge: 'HEALTH',
      rating: 4.65,
      reviewCount: 134,
      image: IMG('photo-1516734212186-a967d81b1248'),
      sellerKey: 'petcare',
    },
    {
      name: 'Small Breed Lamb Formula',
      description:
        'Kibble sized for small jaws with lamb as the hero protein. Fortified with glucosamine for little dogs that jump big.',
      price: 2420,
      stockQuantity: 88,
      categorySlug: 'pet-food',
      targetPets: ['DOG'],
      tags: ['Small-breed', 'Lamb', 'DOG'],
      badge: 'NATURAL',
      rating: 4.5,
      reviewCount: 256,
      image: IMG('photo-1546421840-6154f2bebd35'),
      sellerKey: 'petcare',
    },
    {
      name: 'Natural Rubber Chew Ring',
      description:
        'Durable natural rubber ring for power chewers. Textured surface massages gums; free of BPA and phthalates.',
      price: 450,
      stockQuantity: 175,
      categorySlug: 'toys-play',
      targetPets: ['DOG'],
      tags: ['Chew', 'Durable', 'DOG'],
      badge: 'PLAY',
      rating: 4.4,
      reviewCount: 311,
      image: IMG('photo-1535294472057-21d69d81842e'),
      sellerKey: 'petcare',
    },
    {
      name: 'Travel Silicone Water Bottle',
      description:
        'Flip-bowl travel bottle with one-hand operation. Leak-lock cap; 550 ml—perfect for hikes and road trips with your dog.',
      price: 790,
      stockQuantity: 130,
      categorySlug: 'pet-supplies',
      targetPets: ['DOG'],
      tags: ['Travel', 'Hydration', 'DOG'],
      badge: 'CARE',
      rating: 4.55,
      reviewCount: 142,
      image: IMG('photo-1522276498395-f4f68f7f8451'),
      sellerKey: 'petcare',
    },
    {
      name: 'Eco Poop Bag Refills — 120 count',
      description:
        'Extra-thick plant-based core bags with lavender scent masking. Fits standard dispensers; leak-proof seams.',
      price: 350,
      stockQuantity: 300,
      categorySlug: 'pet-supplies',
      targetPets: ['DOG'],
      tags: ['Outdoor', 'Eco', 'DOG'],
      badge: 'CARE',
      rating: 4.25,
      reviewCount: 498,
      image: IMG('photo-1600077106724-5fbbe39d1384'),
      sellerKey: 'petcare',
    },
    // —— Urban Feline Co. (CAT-forward + universal) ——
    {
      name: 'Tuna Mousse Pâté Multipack',
      description:
        'Silky tuna mousse trays in single-serve portions. High moisture content supports urinary tract health for indoor cats.',
      price: 890,
      stockQuantity: 160,
      categorySlug: 'pet-food',
      targetPets: ['CAT'],
      tags: ['Wet-food', 'Hydration', 'CAT'],
      badge: 'NATURAL',
      rating: 4.5,
      reviewCount: 612,
      image: IMG('photo-1574158622682-e40e69881006'),
      sellerKey: 'feline',
    },
    {
      name: 'Self-Warming Donut Cat Bed',
      description:
        'Plush donut with reflective heat layer—no electricity. Calming raised rim for kneading and deep sleep.',
      price: 3400,
      stockQuantity: 36,
      categorySlug: 'pet-supplies',
      targetPets: ['CAT'],
      tags: ['Comfort', 'Calming', 'CAT'],
      badge: 'LUXURY',
      rating: 4.6,
      reviewCount: 97,
      image: IMG('photo-1494256997604-768d1f608cac'),
      sellerKey: 'feline',
    },
    {
      name: 'Feather Teaser Wand Set',
      description:
        'Three interchangeable feather lures with a flexible fiberglass wand. Encourages stalk-and-pounce play.',
      price: 350,
      stockQuantity: 220,
      categorySlug: 'toys-play',
      targetPets: ['CAT'],
      tags: ['Interactive', 'Exercise', 'CAT'],
      badge: 'PLAY',
      rating: 4.48,
      reviewCount: 445,
      image: IMG('photo-1518791841217-8f162f1e1131'),
      sellerKey: 'feline',
    },
    {
      name: 'Crystal Silica Cat Litter — 10 L',
      description:
        'Low-dust silica crystals lock odor on contact. One bag lasts weeks for a single cat household.',
      price: 1290,
      stockQuantity: 72,
      categorySlug: 'pet-supplies',
      targetPets: ['CAT'],
      tags: ['Odor-control', 'Low-dust', 'CAT'],
      badge: 'CARE',
      rating: 4.32,
      reviewCount: 778,
      image: IMG('photo-1596854407942-bf87f6fdd49e'),
      sellerKey: 'feline',
    },
    {
      name: 'Hairball Relief Malt Paste',
      description:
        'Veterinary-formulated malt and fiber paste helps passage of hairballs. Tuna flavor cats accept readily.',
      price: 590,
      stockQuantity: 95,
      categorySlug: 'health-wellness',
      targetPets: ['CAT'],
      tags: ['Digestive', 'Hairball', 'CAT'],
      badge: 'HEALTH',
      rating: 4.2,
      reviewCount: 156,
      image: IMG('photo-1573865526739-10f1a4d6a129'),
      sellerKey: 'feline',
    },
    {
      name: 'Stainless Steel Cat Fountain 2L',
      description:
        'Whisper-quiet pump with triple filtration and stainless bowl. Encourages hydration with cascading stream.',
      price: 4800,
      stockQuantity: 28,
      categorySlug: 'pet-supplies',
      targetPets: ['CAT'],
      tags: ['Hydration', 'Filter', 'CAT'],
      badge: 'LUXURY',
      rating: 4.92,
      reviewCount: 312,
      image: IMG('photo-1615266895857-cfeda044d4eb'),
      sellerKey: 'feline',
    },
    {
      name: 'Window Hammock Perch',
      description:
        'Industrial suction-cup mount holds up to 15 kg. Fleece pad removable for washing; sunbathing approved.',
      price: 1650,
      stockQuantity: 48,
      categorySlug: 'toys-play',
      targetPets: ['CAT'],
      tags: ['Enrichment', 'Window', 'CAT'],
      badge: 'PLAY',
      rating: 4.52,
      reviewCount: 89,
      image: IMG('photo-1513245543132-31f507179b27'),
      sellerKey: 'feline',
    },
    {
      name: 'Freeze-Dried Minnow Treats',
      description:
        'Single-ingredient minnows freeze-dried at peak freshness. Crunchy texture and briny aroma cats crave.',
      price: 980,
      stockQuantity: 140,
      categorySlug: 'pet-food',
      targetPets: ['CAT'],
      tags: ['Single-ingredient', 'High-value', 'CAT'],
      badge: 'NATURAL',
      rating: 4.78,
      reviewCount: 234,
      image: IMG('photo-1526336024174-e58f5cdd8e13'),
      sellerKey: 'feline',
    },
    {
      name: 'Calming Pheromone Diffuser Refill',
      description:
        '30-day refill for plug-in diffuser; mimics feline facial pheromone to reduce stress from moves and visitors.',
      price: 1100,
      stockQuantity: 60,
      categorySlug: 'health-wellness',
      targetPets: ['CAT'],
      tags: ['Stress', 'Behavior', 'CAT'],
      badge: 'HEALTH',
      rating: 4.38,
      reviewCount: 201,
      image: IMG('photo-1450778869180-41d0601e046e'),
      sellerKey: 'feline',
    },
    {
      name: 'Adjustable Recovery Collar (Cone)',
      description:
        'Clear padded e-collar with snap sizing for dogs and cats post-surgery. Lightweight and non-marking edge.',
      price: 680,
      stockQuantity: 90,
      categorySlug: 'health-wellness',
      targetPets: [],
      tags: ['Recovery', 'Post-op', 'Universal'],
      badge: 'HEALTH',
      rating: 4.33,
      reviewCount: 167,
      image: IMG('photo-1628009368231-7bb7cfcb0def'),
      sellerKey: 'feline',
    },
    {
      name: 'Interactive Treat Puzzle — Level 2',
      description:
        'Slide and flip compartments hide kibble or treats. Mental enrichment for bright dogs; reduces boredom digging.',
      price: 2200,
      stockQuantity: 52,
      categorySlug: 'toys-play',
      targetPets: ['DOG'],
      tags: ['Enrichment', 'Puzzle', 'DOG'],
      badge: 'PLAY',
      rating: 4.62,
      reviewCount: 124,
      image: IMG('photo-1558929996-da64ba858215'),
      sellerKey: 'petcare',
    },
  ];
}

async function run() {
  await connectDB();

  const petCareOwner = await ensureShopOwner({
    email: 'shop.petcareplus.grooming@pawsewa.seed',
    name: 'Pet Care+ Grooming',
    facilityName: 'Pet Care+ Grooming',
  });

  const felineOwner = await ensureShopOwner({
    email: 'shop.urban.feline@pawsewa.seed',
    name: 'The Urban Feline Co.',
    facilityName: 'The Urban Feline Co.',
  });

  const sellers = {
    petcare: petCareOwner._id,
    feline: felineOwner._id,
  };

  const categorySpecs = [
    {
      slug: 'pet-food',
      name: 'Pet Food',
      image: IMG('photo-1583337130417-3346a1be7dee'),
    },
    {
      slug: 'health-wellness',
      name: 'Health & Wellness',
      image: IMG('photo-1601758224634-281c0353bd1b'),
    },
    {
      slug: 'toys-play',
      name: 'Toys & Play',
      image: IMG('photo-1548546738-8509cb246ed3'),
    },
    {
      slug: 'collars-leashes',
      name: 'Collars & Leashes',
      image: IMG('photo-1548199973-35812388d1b4'),
    },
    {
      slug: 'pet-supplies',
      name: 'Pet Supplies',
      image: IMG('photo-1535294435445-d7249524ef2e'),
    },
  ];

  const catBySlug = {};
  for (const spec of categorySpecs) {
    // eslint-disable-next-line no-await-in-loop
    const c = await ensureCategory(spec.slug, spec.name, spec.image);
    catBySlug[spec.slug] = c._id;
  }

  const deleted = await Product.deleteMany({});
  console.log('[SEEDER] Cleared existing products:', deleted.deletedCount);

  const defs = buildProductDefs();
  const docs = defs.map((d) => {
    const sellerId = sellers[d.sellerKey];
    const targetPets = d.targetPets || [];
    return {
      name: d.name,
      description: d.description,
      price: d.price,
      stockQuantity: d.stockQuantity,
      category: catBySlug[d.categorySlug],
      seller: sellerId,
      vendorId: sellerId,
      images: [d.image],
      isAvailable: true,
      rating: Math.round(d.rating * 100) / 100,
      reviewCount: d.reviewCount,
      petTypes: petTypesFromTarget(targetPets),
      targetPets,
      tags: d.tags || [],
      badge: d.badge || '',
    };
  });

  await Product.insertMany(docs);

  const dogPetCare = await Product.countDocuments({
    seller: petCareOwner._id,
    targetPets: 'DOG',
  });

  console.log('[SEEDER] 20+ Premium products created with web-sourced images.');
  console.log(`[SEEDER] (${docs.length} records inserted.)`);
  console.log('[SEEDER] Recommendation tags (DOG/CAT) applied for personalization.');
  console.log(
    `[SEEDER] Pet Care+ Grooming shop_owner has ${dogPetCare} DOG-tagged products (target: ≥5).`
  );

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('[SEEDER] productSeeder failed:', err);
  process.exit(1);
});
