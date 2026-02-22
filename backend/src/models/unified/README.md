# Unified Models for pawsewa_production

Collections: **users**, **pets**, **services**, **appointments**, **orders**, **chat_messages**

## Role Mapping

| Old Role           | New Role      |
|--------------------|---------------|
| pet_owner          | CUSTOMER      |
| veterinarian       | VET           |
| admin              | ADMIN         |
| rider              | RIDER         |
| hostel_owner, groomer, trainer, shop_owner, care_service, etc. | SERVICE_OWNER |

## Populate for Readable Compass View

To view appointments with pet name and owner name in MongoDB Compass:

```javascript
// In your API/controller
const appointments = await AppointmentUnified.find()
  .populate('petId', 'name pawId')
  .populate('customerId', 'name email phone')
  .populate('staffId', 'name')
  .sort({ createdAt: -1 })
  .lean();
```

## Timestamps

All unified models use Mongoose `timestamps: true` → `createdAt`, `updatedAt`.

## Migration

Run: `npm run migrate:production`

Uses MONGO_URI, SOURCE_DB (default: from URI), TARGET_DB (default: pawsewa_production).
