# 🐾 PawSewa — Overnight Delta Build Task for Cursor AI
> **Version:** 2.0 Delta  
> **Brand Color:** `#703418` (Deep Brown)  
> **Prepared for:** Cursor AI — Autonomous Overnight Execution  
> **Architecture by:** Lead Architect Review of A3 Artefact Design (Student: Suraj Tamang, ID: 2434749)

---

## ⚠️ CRITICAL INSTRUCTIONS FOR CURSOR — READ BEFORE EXECUTING ANYTHING

```
RULE 1: NEVER create a new file if one already exists. Always CHECK FIRST.
RULE 2: For every task, scan the existing codebase. If logic exists → MODIFY. If missing → CREATE.
RULE 3: Execute tasks in the ORDER listed. Do not skip phases.
RULE 4: After each phase, run a self-check: "Does this break any existing functionality?"
RULE 5: Commit changes after each Phase with a descriptive message.
RULE 6: If a file or function is ambiguous, err on the side of EXTENDING, not replacing.
RULE 7: All 4 platforms must be kept in sync. If you add a feature to one, mirror it everywhere it applies.
```

---

## 🗺️ PLATFORM MAP

| ID | Platform | Folder (typical) | Primary Users |
|----|----------|-----------------|---------------|
| P1 | **Customer App** | `/customer_app` or `/mobile` | Pet Owners |
| P2 | **Customer Website** | `/customer_web` or `/web` | Pet Owners (web) |
| P3 | **Partner App** | `/partner_app` or `/rider_app` | Riders, Sellers, Vets, Hostel/Care Center Owners |
| P4 | **Admin Panel** | `/admin` or `/admin_panel` | PawSewa Admins |

> **Before starting:** Run `ls` or `tree -L 2` at root to confirm actual folder names and update references accordingly.

---

## 🎨 PHASE 0 — Global Brand Token Injection

**Objective:** Apply `#703418` (Deep Brown) as the primary brand color across ALL 4 platforms without breaking layouts.

### Step-by-step:

**0.1 — CHECK for existing theme/token files:**
```
CHECK: Does /customer_app/src/theme.js (or theme.ts / tokens.js / colors.js / tailwind.config.js) exist?
  → YES: Open it. Find the primary color variable. Change it to #703418.
  → NO:  Create /customer_app/src/theme.js with the tokens below.

Repeat for /customer_web, /partner_app, /admin.
```

**0.2 — Universal Color Tokens to inject/update:**
```js
// pawsewa-tokens.js (or merge into existing theme file)
export const PawSewaColors = {
  primary:        '#703418',  // Deep Brown — buttons, headers, active nav
  primaryLight:   '#9B5A3A',  // Hover states
  primaryDark:    '#4E2410',  // Pressed states
  primarySurface: '#F5EDE8',  // Light background tints
  accent:         '#D4874A',  // Warm amber accent
  success:        '#2D7A4F',
  warning:        '#C97D20',
  error:          '#C0392B',
  textPrimary:    '#1A0E09',
  textSecondary:  '#6B4C3B',
  background:     '#FDF8F5',
  surface:        '#FFFFFF',
  border:         '#E8D5C8',
};
```

**0.3 — CSS/Tailwind injection (web platforms):**
```css
/* Check if :root variables exist in global CSS. Update or add: */
:root {
  --color-primary:         #703418;
  --color-primary-light:   #9B5A3A;
  --color-primary-dark:    #4E2410;
  --color-primary-surface: #F5EDE8;
  --color-accent:          #D4874A;
  --color-text-primary:    #1A0E09;
  --color-text-secondary:  #6B4C3B;
  --color-background:      #FDF8F5;
  --color-border:          #E8D5C8;
}
```

**0.4 — Audit checklist after color injection:**
- [ ] All `<Button>` components use `primary` color
- [ ] Navigation active states use `#703418`
- [ ] All header bars are `#703418` or `primarySurface`
- [ ] No hardcoded hex colors remain in component files
- [ ] Dark mode (if exists) uses `primaryDark` variant

---

## 🔐 PHASE 1 — Authentication Unification (All 4 Platforms)

### Existing vs. Target

| Feature | Existing State | Target State |
|---------|---------------|--------------|
| Email/Password Login | Likely implemented | Verify working on all 4 platforms |
| Google Sign-In | Partial / unknown | Working on P1 (App) + P2 (Web). Not required on P3/P4 |
| OTP (Phone) | Partial / unknown | Working on P1 + P2. Admin uses email only |
| Email Verification | Partial / unknown | Mandatory on P1 + P2 registration |
| Khalti Payment | Partial / unknown | Working on P1 + P2 for orders + subscriptions |

### Step-by-step:

**1.1 — CHECK Google Sign-In:**
```
CHECK: Does /customer_app/src/auth/GoogleAuth.js (or similar) exist?
  → YES: Test it. If broken, locate the Google Client ID in .env. Ensure it is loaded.
         Common fix: GoogleSignin.configure({ webClientId: process.env.GOOGLE_CLIENT_ID });
  → NO:  Install @react-native-google-signin/google-signin (app) or react-oauth/google (web).
         Create /customer_app/src/auth/GoogleAuth.js and /customer_web/src/auth/GoogleAuth.js

Backend CHECK: Does POST /api/auth/google exist?
  → YES: Verify it creates/finds user, returns JWT.
  → NO:  Create it. Accept { idToken }, verify with google-auth-library, return JWT + user object.
```

**1.2 — CHECK OTP (Phone Verification):**
```
CHECK: Does /customer_app/src/auth/OtpScreen.js exist?
  → YES: Ensure it calls POST /api/auth/send-otp and POST /api/auth/verify-otp.
  → NO:  Create OtpScreen.js with a 6-digit input and 60s resend timer.

Backend CHECK: Does POST /api/auth/send-otp exist?
  → YES: Verify it uses Twilio or Firebase. Check .env for credentials.
  → NO:  Create it. Use twilio or firebase-admin. Store OTP in Redis or DB with 5min TTL.
         Also create POST /api/auth/verify-otp.
```

**1.3 — CHECK Email Verification:**
```
CHECK: Does the user registration flow send a verification email?
  → YES: Verify the link works and marks user.emailVerified = true in DB.
  → NO:  After POST /api/auth/register, send verification email with JWT link.
         Create GET /api/auth/verify-email?token=xxx endpoint.
         Block login if emailVerified === false (show "Please verify your email" message).
```

**1.4 — CHECK Khalti Payment:**
```
CHECK: Does /customer_app/src/payment/KhaltiPayment.js or KhaltiWebView exist?
  → YES: Verify the flow: initiate → KhaltiCheckout → verify on backend.
  → NO:  Install khalti-checkout-web (web) or use WebView for app.
         Create POST /api/payment/khalti/initiate  → returns pidx
         Create POST /api/payment/khalti/verify    → verifies with Khalti API, marks order/subscription PAID

Ensure Khalti is connected to:
  - Product orders (Care+ shop)
  - Service subscriptions
  - Vet appointment bookings
```

---

## 🗺️ PHASE 2 — Map System Unification

### Existing vs. Target

| Platform | Map Status | Target |
|----------|-----------|--------|
| P1 Customer App | ✅ Implemented | Source of truth — extract logic |
| P2 Customer Web | ❌ Missing | Port from P1 using react-leaflet or Google Maps JS |
| P3 Partner App | ❌ Missing | Port from P1 — show assigned orders/jobs on map |
| P4 Admin Panel | ❌ Missing | Port from P1 — show all active riders/orders on map |

### Step-by-step:

**2.1 — Extract Map logic from Customer App:**
```
CHECK: Where is the map implemented in /customer_app?
  Common locations: /src/screens/MapScreen.js, /src/components/MapView.js, /src/utils/mapUtils.js

Extract these reusable pieces:
  1. getCurrentLocation() utility
  2. MapContainer or MapView component
  3. Marker rendering logic
  4. Distance calculation (if any)
  5. Any WebSocket/socket.io integration for live tracking

Create: /shared/map/ folder (or /packages/map/ if monorepo)
  → /shared/map/MapComponent.js      (universal map component)
  → /shared/map/useGeolocation.js    (hook for live location)
  → /shared/map/mapUtils.js          (distance, geocoding helpers)
```

**2.2 — Customer Website Map:**
```
CHECK: Does /customer_web/src/components/Map exist?
  → YES: Update it to use shared map logic.
  → NO:  Create /customer_web/src/components/Map/MapView.jsx
         Use react-leaflet (if no Google Maps key) or @react-google-maps/api
         Show:
           - User's current location
           - Nearby vets (from GET /api/vets/nearby?lat=X&lng=Y)
           - Nearby hostels
           - Active order/rider location (if order in transit)
```

**2.3 — Partner App Map (Riders/Sellers/Vets):**
```
CHECK: Does /partner_app/src/screens/MapScreen exist?
  → YES: Enhance it with job/assignment markers.
  → NO:  Create it using shared map logic.
         Show:
           - Rider's current location (sent to backend via socket every 10s)
           - Assigned pickup location (from order)
           - Assigned delivery/drop location
           - Route between the two (use Directions API or OSRM)

Add: Background location tracking
  CHECK: Is @react-native-community/geolocation or expo-location installed?
  → YES: Use it.
  → NO:  Install and configure.
  Emit socket event: socket.emit('rider:location', { riderId, lat, lng }) every 10 seconds when job active.
```

**2.4 — Admin Panel Map:**
```
CHECK: Does /admin/src/pages/LiveMap or /admin/src/components/MapDashboard exist?
  → YES: Enhance it.
  → NO:  Create /admin/src/pages/LiveMap/LiveMapDashboard.jsx

Show on Admin map:
  - All active riders (real-time dots, colored by status: available=green, on-job=orange)
  - All pending orders (pin at pickup location)
  - All active service bookings (pin at service location)
  - Click a pin → see order/booking details + assign button

Backend: Ensure GET /api/admin/live-map returns:
  { riders: [{id, name, lat, lng, status}], orders: [{id, lat, lng, status}], bookings: [...] }
```

---

## 🔄 PHASE 3 — Care+ Product Order Chain (Full Assignment Workflow)

### Workflow Diagram
```
Customer orders product (P1/P2)
        ↓
Order created → status: AWAITING_ADMIN
        ↓
Admin Panel notified (real-time + notification badge)
        ↓
Admin opens order → clicks "Assign Seller"
        ↓
Seller receives notification in Partner App → confirms stock
        ↓
Admin assigns Rider → status: ASSIGNED_TO_RIDER
        ↓
Rider receives "Job Available" ping → accepts
        ↓
Rider picks up → status: IN_TRANSIT (map tracking active)
        ↓
Rider delivers → status: COMPLETED
        ↓
Customer notified → can leave review
```

### Step-by-step:

**3.1 — Update Order Schema:**
```
CHECK: Where is the Order model? (e.g., /backend/models/Order.js or Order.model.ts)
  → FOUND: Add these fields if missing:

  status: {
    type: String,
    enum: ['PENDING', 'AWAITING_ADMIN', 'ASSIGNED_TO_SELLER', 'SELLER_CONFIRMED',
           'ASSIGNED_TO_RIDER', 'RIDER_ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
    default: 'AWAITING_ADMIN'
  },
  sellerId:   { type: ObjectId, ref: 'User', default: null },
  riderId:    { type: ObjectId, ref: 'User', default: null },
  sellerConfirmedAt: Date,
  riderAcceptedAt:   Date,
  deliveredAt:       Date,
  pickupLocation:    { lat: Number, lng: Number, address: String },
  dropLocation:      { lat: Number, lng: Number, address: String },
  customerNote:      String,
  adminNote:         String,

  → NOT FOUND: Create /backend/models/Order.js with all fields above + standard fields
    (orderId, customerId, items[], totalAmount, paymentStatus, paymentMethod, createdAt, updatedAt)
```

**3.2 — Order Creation (Customer Side):**
```
CHECK: Does POST /api/orders/create exist?
  → YES: Ensure it:
    1. Creates order with status: 'AWAITING_ADMIN'
    2. Emits socket event: io.to('admin_room').emit('new:order', orderData)
    3. Sends push notification to admin (FCM/Expo)
    4. Returns order confirmation to customer
  → NO:  Create it with all of the above.

CHECK: Does the Customer App have an order confirmation screen?
  → YES: Ensure it shows order ID + "Your order is being processed" with status tracker.
  → NO:  Create /customer_app/src/screens/OrderConfirmation.js
```

**3.3 — Admin Panel: Order Management Interface:**
```
CHECK: Does /admin/src/pages/Orders exist?
  → YES: Enhance it with:
    - Tab: "Awaiting Assignment" — orders with status AWAITING_ADMIN
    - For each order: show items, customer info, delivery address, Khalti payment status
    - Button: "Assign to Seller" → opens modal with seller dropdown (filtered by available sellers)
    - After seller assigned: button changes to "Assign Rider"
    - Button: "Assign Rider" → opens modal with available riders on mini-map
  → NO:  Create /admin/src/pages/Orders/OrdersPage.jsx with all above.

API needed:
  GET  /api/admin/orders?status=AWAITING_ADMIN
  POST /api/admin/orders/:id/assign-seller  { sellerId }
  POST /api/admin/orders/:id/assign-rider   { riderId }
  GET  /api/admin/sellers?available=true
  GET  /api/admin/riders?available=true
```

**3.4 — Partner App: Seller View:**
```
CHECK: Does /partner_app have a Seller-specific screen/tab?
  → YES: Add to it.
  → NO:  Create /partner_app/src/screens/Seller/SellerDashboard.js

Seller sees:
  - Incoming order assignments (push notification + in-app list)
  - Order details: items, quantities, customer drop address
  - Button: "Confirm Stock" → calls PATCH /api/orders/:id/seller-confirm
  - After confirmation, order moves to SELLER_CONFIRMED and admin is notified

Socket: seller joins room `seller_${sellerId}` on login
  io.to(`seller_${sellerId}`).emit('new:assignment', orderData)
```

**3.5 — Partner App: Rider View:**
```
CHECK: Does /partner_app have a Rider-specific screen/tab?
  → YES: Add job notification logic.
  → NO:  Create /partner_app/src/screens/Rider/RiderDashboard.js

Rider sees:
  - "Job Available" push + in-app ping when assigned by admin
  - Job card: pickup location, drop location, estimated distance
  - Button: "Accept Job" → PATCH /api/orders/:id/rider-accept
  - After accepting: Map screen shows pickup → drop route
  - Button: "Picked Up" → PATCH /api/orders/:id/picked-up → status: IN_TRANSIT
  - Button: "Delivered" → PATCH /api/orders/:id/delivered → status: COMPLETED
  - Location emitted to socket every 10s during transit

Socket: rider joins room `rider_${riderId}` on login
  io.to(`rider_${riderId}`).emit('job:available', jobData)
```

**3.6 — Customer: Live Order Tracking:**
```
CHECK: Does the Customer App/Web have a live tracking screen?
  → YES: Connect it to socket for real-time rider location.
  → NO:  Create:
    /customer_app/src/screens/OrderTracking.js
    /customer_web/src/pages/OrderTracking.jsx

  Show:
    - Status timeline (AWAITING_ADMIN → ASSIGNED_TO_SELLER → IN_TRANSIT → DELIVERED)
    - When IN_TRANSIT: live map with rider's moving dot
    - Rider name, photo, phone (tap to call)
    - ETA (calculated from map distance)

  Subscribe to socket: socket.on('rider:location:update', ({ lat, lng }) => updateMap())
```

---

## 🏥 PHASE 4 — Care+ Service Booking Chain (Vet / Grooming / Hostel)

### Workflow Diagram
```
Customer books service (P1/P2) → status: AWAITING_ADMIN
        ↓
Admin Panel receives booking (notification + list)
        ↓
Admin reviews → assigns to specific Vet / Groomer / Hostel in Partner App
        ↓
Service provider sees booking in Partner App → confirms
        ↓
Booking status → CONFIRMED
        ↓
Customer notified → booking confirmed
        ↓
Service delivered → provider marks COMPLETED
        ↓
Vet updates pet health record (if Vet appointment)
```

### Step-by-step:

**4.1 — Update Booking Schema:**
```
CHECK: Where is the Booking model? (e.g., /backend/models/Booking.js)
  → FOUND: Add if missing:

  status: {
    type: String,
    enum: ['AWAITING_ADMIN', 'ASSIGNED', 'CONFIRMED_BY_PROVIDER',
           'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    default: 'AWAITING_ADMIN'
  },
  serviceType: { type: String, enum: ['VET', 'GROOMING', 'HOSTEL', 'VACCINATION', 'CHECKUP'] },
  providerId:  { type: ObjectId, ref: 'User', default: null },
  providerType:{ type: String, enum: ['VET', 'GROOMER', 'HOSTEL_OWNER'] },
  assignedAt:  Date,
  confirmedAt: Date,
  completedAt: Date,
  consultationNotes: String,  // filled by vet after appointment
  adminNote:   String,

  → NOT FOUND: Create full Booking model.
```

**4.2 — Admin Panel: Booking Assignment Interface:**
```
CHECK: Does /admin/src/pages/Bookings exist?
  → YES: Add assignment workflow.
  → NO:  Create /admin/src/pages/Bookings/BookingsPage.jsx

Admin sees:
  - All bookings with status AWAITING_ADMIN in a dedicated queue
  - Filter by: serviceType, date, area
  - Each booking shows: pet name, owner name, service type, preferred time
  - "Assign Provider" button → modal lists available vets/groomers/hostels
    (filtered by serviceType and availability on that date/time)
  - After assignment: PATCH /api/admin/bookings/:id/assign { providerId, providerType }
  - Booking status → ASSIGNED, provider notified

API needed:
  GET  /api/admin/bookings?status=AWAITING_ADMIN
  POST /api/admin/bookings/:id/assign  { providerId, providerType }
  GET  /api/admin/providers?type=VET&available=true
```

**4.3 — Partner App: Service Provider View (Vet/Groomer/Hostel):**
```
CHECK: Does /partner_app have a provider dashboard?
  → YES: Add booking notifications.
  → NO:  Create /partner_app/src/screens/Provider/ProviderDashboard.js

Provider sees:
  - Incoming booking notification (push + in-app)
  - Booking details: pet profile, owner info, service type, date/time
  - Pet's medical history (for Vet view — read from PetHealth model)
  - Button: "Confirm Booking" → PATCH /api/bookings/:id/confirm
  - Button: "Mark Completed" → PATCH /api/bookings/:id/complete
  - For Vets after completion: "Add Consultation Notes" → form to update pet health record
```

---

## 🐾 PHASE 5 — Pet Health Tracking (Bi-Directional Sync)

### Existing vs. Target

| Feature | Existing | Target |
|---------|----------|--------|
| Health tracker UI (Customer App) | Partial | Full — vaccines, weight, allergies, deworming |
| Health tracker (Customer Web) | Missing | Mirror of app |
| Vet can view health record | Unknown | Required — in Partner App |
| Vet can edit health record | Unknown | Required — after consultation |
| Admin can view all pet records | Unknown | Required — read-only in Admin Panel |

### Step-by-step:

**5.1 — PetHealth Model:**
```
CHECK: Does /backend/models/PetHealth.js (or PetProfile.js) exist?
  → FOUND: Ensure it has these fields:

  petId:        { type: ObjectId, ref: 'PetProfile', required: true },
  vaccines: [{
    name:         String,   // e.g., "Rabies", "Distemper"
    dateGiven:    Date,
    nextDueDate:  Date,
    vetId:        ObjectId, // who administered
    notes:        String,
  }],
  weight: [{
    value:   Number,  // in kg
    date:    Date,
    vetId:   ObjectId,
  }],
  allergies:      [String],
  medications: [{
    name:       String,
    dosage:     String,
    startDate:  Date,
    endDate:    Date,
    prescribedBy: ObjectId,
  }],
  conditions:     [String],  // e.g., "Hip Dysplasia"
  dewormingHistory: [{
    date:   Date,
    product: String,
  }],
  lastCheckupDate: Date,
  nextCheckupDate: Date,
  consultationNotes: [{
    vetId:    ObjectId,
    date:     Date,
    diagnosis:  String,
    treatment:  String,
    followUpDate: Date,
  }],
  updatedBy:   ObjectId,
  updatedAt:   Date,

  → NOT FOUND: Create full model.
```

**5.2 — API Endpoints for Pet Health:**
```
CHECK for each endpoint — create only if missing:

GET    /api/pets/:petId/health          → Customer + Vet + Admin (role-gated)
PUT    /api/pets/:petId/health          → Customer (owner fields only: allergies, weight)
POST   /api/pets/:petId/health/vaccine  → Vet only
POST   /api/pets/:petId/health/consultation → Vet only (after appointment)
PUT    /api/pets/:petId/health/weight   → Vet + Customer
GET    /api/admin/pets                  → Admin (list all pets with health summaries)

Middleware: Verify JWT role for each route.
  - Customer: can only access their own pets
  - Vet: can access pets with a confirmed/completed booking with them
  - Admin: full read access
```

**5.3 — Customer App: Pet Health UI:**
```
CHECK: Does /customer_app/src/screens/PetHealth.js exist?
  → YES: Ensure it displays all fields from PetHealth model.
  → NO:  Create it.

Sections:
  1. Overview card: pet photo, name, breed, age, weight trend chart (recharts/victory)
  2. Vaccination timeline: list with due-date alerts (red if overdue)
  3. Medications: active medications list
  4. Allergies: editable tags
  5. Consultation history: timeline of past vet visits
  6. "Add Weight" button → quick modal

Alert: If any vaccination is overdue → show banner "⚠️ [Vaccine] is overdue! Book a vet now."
  → Button links to vet booking flow.
```

**5.4 — Customer Website: Pet Health (Mirror App):**
```
CHECK: Does /customer_web/src/pages/PetHealth exist?
  → YES: Ensure feature parity with app.
  → NO:  Create /customer_web/src/pages/PetHealth/PetHealthPage.jsx
         Same sections as app. Use recharts for weight trend graph.
```

**5.5 — Partner App: Vet View of Pet Health:**
```
CHECK: Does /partner_app/src/screens/PetHealthView exist?
  → YES: Verify vet can edit consultation notes.
  → NO:  Create /partner_app/src/screens/Vet/PetHealthView.js

Vet sees (when opening an assigned booking):
  - Full pet health record (read)
  - After clicking "Complete Consultation":
    → Form: diagnosis, treatment, medications prescribed, follow-up date
    → On submit: POST /api/pets/:petId/health/consultation
    → Pet owner is notified: "Your vet has updated [PetName]'s health record"
```

---

## 💬 PHASE 6 — Real-Time Communication Hub (Socket.io)

### Existing vs. Target

| Event | Existing | Target |
|-------|----------|--------|
| Chat (Customer ↔ Vet) | Partial | Working on P1 + P3 |
| Chat (Customer ↔ Admin) | Unknown | Add to P1 + P4 |
| Order status notifications | Unknown | P1, P2, P3, P4 |
| Rider location broadcast | Unknown | P1, P2 (customer tracking) + P4 (admin map) |
| Admin system-wide alerts | Unknown | P4 only |
| "Job Available" ping to Rider | Unknown | P3 only |

### Step-by-step:

**6.1 — Backend Socket.io Setup:**
```
CHECK: Does /backend/socket.js or /backend/sockets/ exist?
  → YES: Extend it. DO NOT replace.
  → NO:  Create /backend/socket.js

Structure:
  const rooms = {
    admin:    'admin_room',          // all admins join this
    seller:   (id) => `seller_${id}`,
    rider:    (id) => `rider_${id}`,
    customer: (id) => `customer_${id}`,
    vet:      (id) => `vet_${id}`,
    order:    (id) => `order_${id}`,  // all parties in an order join this
  }

Events to handle:
  CLIENT → SERVER:
    'join:room'         { userId, role }       → join correct rooms
    'rider:location'    { riderId, lat, lng }   → broadcast to order room + admin_room
    'chat:message'      { fromId, toId, text }  → save to DB + emit to recipient
    'mark:delivered'    { orderId, riderId }     → update order + notify customer

  SERVER → CLIENT:
    'new:order'              → admin_room
    'new:booking'            → admin_room
    'order:assigned_seller'  → seller room
    'order:assigned_rider'   → rider room
    'job:available'          → rider room
    'booking:assigned'       → vet/provider room
    'rider:location:update'  → customer room + admin_room
    'order:status:changed'   → customer room
    'booking:status:changed' → customer room
    'chat:message:received'  → recipient room
    'system:alert'           → admin_room (e.g., "New user registered", "Payment failed")
```

**6.2 — Admin Panel: Real-Time Notification Center:**
```
CHECK: Does /admin/src/components/NotificationBell or NotificationCenter exist?
  → YES: Connect it to socket.
  → NO:  Create /admin/src/components/NotificationCenter/NotificationBell.jsx

Admin panel connects to socket on login → joins 'admin_room'
Shows live notification count badge.
On click → dropdown list of recent events:
  - "🛒 New order #1234 from Ramesh K."    [View] [Assign Seller]
  - "📅 New vet booking from Sita M."      [View] [Assign Vet]
  - "💳 Payment received for order #1233"  [View]
  - "🚴 Rider Bikash is now active"        [View on Map]

Clicking [View] opens the relevant order/booking detail modal.
```

**6.3 — Chat System Check:**
```
CHECK: Does chat exist between Customer ↔ Vet?
  → YES: Ensure it works on both P1 (app) and P3 (partner app).
         Add: Customer ↔ Admin support chat.
  → NO:  Create:
    /backend/models/ChatMessage.js  { fromId, toId, text, read, createdAt }
    POST /api/chat/send             { toId, text }
    GET  /api/chat/:withUserId      → returns message history
    /customer_app/src/screens/Chat/ChatScreen.js
    /partner_app/src/screens/Chat/ChatScreen.js

Chat on Customer App:
  - Chat with assigned Vet (after booking confirmed)
  - Chat with Admin/Support

Chat on Partner App (Vet):
  - Chat with customer about their pet
```

---

## 📱 PHASE 7 — Feature Parity: Customer App ↔ Customer Website

### Missing Features Audit

Check each item. If missing on Website, add it:

| Feature | App | Website | Action |
|---------|-----|---------|--------|
| Home dashboard with banners | ✅ | ❓ | Mirror app home |
| Quick service buttons (Vet/Hostel/Tips/Food) | ✅ | ❓ | Add to web nav |
| Product shop (Care+) | ✅ | ❓ | Full shop page |
| Pet profiles management | ✅ | ❓ | Add pet CRUD |
| Pet health tracking | ✅ | ❓ | Full health page |
| Vet appointment booking | ✅ | ❓ | Booking flow |
| Hostel booking | ✅ | ❓ | Hostel listing + book |
| Grooming booking | ✅ | ❓ | Booking flow |
| Subscription plans (Care+) | ✅ | ❓ | Plans page + Khalti |
| Vaccination reminders | ✅ | ❓ | Notification settings |
| Order tracking (live map) | ✅ | ❓ | Tracking page |
| Chat with vet | ✅ | ❓ | Chat page |
| Progress report download | ✅ | ❓ | PDF export button |
| Google Sign-In | ✅ | ❓ | Add to web auth |
| Notifications center | ✅ | ❓ | Add bell icon |
| Nearby vets (map) | ✅ | ❓ | Map page |

### Step-by-step for Website:

**7.1 — Website Routing Check:**
```
CHECK: What router is used? (React Router / Next.js / Vue Router)
Ensure these routes exist:
  /                     → Home
  /shop                 → Product shop
  /shop/:productId      → Product detail
  /cart                 → Shopping cart
  /checkout             → Checkout + Khalti
  /orders               → Order history
  /orders/:orderId      → Order tracking
  /services             → All services
  /book/vet             → Vet booking
  /book/hostel          → Hostel booking
  /book/grooming        → Grooming booking
  /pets                 → My pets list
  /pets/:petId          → Pet profile + health
  /care-plus            → Subscription plans
  /chat                 → Chat with vet/support
  /profile              → User profile + settings
  /notifications        → Notification history
  /map                  → Nearby vets/services map
```

**7.2 — Progress Report PDF (Customer App + Web):**
```
CHECK: Does a "Download Health Report" feature exist?
  → YES: Verify it generates a proper PDF.
  → NO:  Create:
    Backend: GET /api/pets/:petId/report → generates PDF using pdfkit or puppeteer
    PDF includes: pet photo, basic info, vaccination history, weight chart, consultation notes
    
    Customer App: Button in PetHealth screen → calls API → shares/downloads PDF
    Customer Web: Button in PetHealth page → downloads PDF
```

---

## 👑 PHASE 8 — Care+ UI Excellence

### Step-by-step:

**8.1 — Care+ Subscription Plans Page:**
```
CHECK: Does a subscription/care+ plans page exist on P1 and P2?
  → YES: Enhance the UI.
  → NO:  Create it on both.

Plans to show:
  BASIC (Free):
    - 1 pet profile
    - Basic health tracking
    - Access to shop

  SILVER (Rs. 499/month):
    - Up to 3 pets
    - Vaccination reminders
    - Monthly checkup discount (10%)
    - Chat with vet (5 msgs/month)

  GOLD — Care+ (Rs. 999/month):
    - Unlimited pets
    - Full health tracking + reports
    - Unlimited vet chat
    - Priority booking
    - 20% discount on all services
    - Free monthly checkup
    - Access to hostel booking

UI Requirements:
  - Cards with brand color #703418 gradient
  - Most popular = GOLD, highlighted with badge
  - "Current Plan" indicator
  - Khalti payment integration for upgrade
  - Annual billing option (2 months free)
```

**8.2 — Product Shop UI:**
```
CHECK: Does the shop exist and look polished?
  → YES: Verify all product categories, search, and cart work.
  → NO:  Create full shop.

Categories: Food, Toys, Medicine, Accessories, Grooming Supplies
Features:
  - Search + filter by category/price
  - Product cards with image, name, price in NPR
  - Add to cart → cart badge updates
  - Cart page → update quantities, remove items
  - Checkout → address form → Khalti payment → order confirmation
  - Order history with status tracking
```

---

## 🔔 PHASE 9 — Push Notifications (FCM/Expo)

**9.1 — CHECK notification setup:**
```
CHECK: Is Firebase Cloud Messaging (FCM) or Expo Notifications configured?
  → YES: Ensure notification tokens are stored per user in DB.
  → NO:  
    For React Native App: Install expo-notifications or @react-native-firebase/messaging
    For Web: Use Firebase Web SDK for web push
    
Backend:
  Add to User model: { fcmToken: String, webPushToken: String }
  Create: /backend/utils/notifications.js
    sendPushNotification(userId, { title, body, data }) → looks up fcmToken, sends via FCM

Trigger notifications for:
  Customer:
    - Order status changes (every status update)
    - Booking confirmed/assigned
    - Vaccination due date reminder (cron job: daily at 9am)
    - Chat message received
    - Vet added consultation notes

  Seller:
    - New order assigned

  Rider:
    - New job available

  Admin:
    - New order placed
    - New booking made
    - Payment received/failed
```

---

## 🔒 PHASE 10 — Security & Final Audit

**10.1 — API Security:**
```
CHECK for each API route group:
  - Is JWT middleware applied? (authMiddleware)
  - Is role validation applied? (requireRole('admin') etc.)
  - Are inputs sanitized? (express-validator or joi)

Ensure:
  POST /api/admin/*  → admin only
  POST /api/partner/* → seller/rider/vet only
  GET  /api/pets/:petId/health → owner OR assigned vet OR admin only
  PATCH /api/orders/:id/assign-* → admin only
```

**10.2 — Environment Variables Audit:**
```
CHECK: Does .env.example exist at root?
  → Create/update with all required keys:

  # Database
  MONGODB_URI=

  # Auth
  JWT_SECRET=
  JWT_EXPIRES_IN=7d

  # Google OAuth
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=

  # OTP / SMS
  TWILIO_ACCOUNT_SID=
  TWILIO_AUTH_TOKEN=
  TWILIO_PHONE_NUMBER=

  # Email
  SMTP_HOST=
  SMTP_PORT=
  SMTP_USER=
  SMTP_PASS=
  EMAIL_FROM=

  # Khalti Payment
  KHALTI_SECRET_KEY=
  KHALTI_PUBLIC_KEY=

  # Firebase
  FCM_SERVER_KEY=
  FIREBASE_CONFIG= (JSON string)

  # Maps
  GOOGLE_MAPS_API_KEY=

  # App URLs
  CLIENT_URL=
  ADMIN_URL=
  PARTNER_URL=
```

**10.3 — CORS Configuration:**
```
CHECK: Is CORS configured on backend?
  → Update to allow:
    origin: [process.env.CLIENT_URL, process.env.ADMIN_URL, process.env.PARTNER_URL]
    credentials: true
```

---

## ✅ PHASE 11 — Final Cross-Platform Validation Checklist

After all phases, verify each item:

### Authentication
- [ ] Customer can register with email + OTP verification
- [ ] Customer can login with email/password
- [ ] Customer can login with Google (App + Web)
- [ ] Vet can login with credentials (Partner App)
- [ ] Rider can login with credentials (Partner App)
- [ ] Seller can login with credentials (Partner App)
- [ ] Admin can login (Admin Panel only, no Google)
- [ ] Khalti payment works end-to-end (initiate → verify → mark paid)

### Product Order Flow
- [ ] Customer can browse shop and add to cart
- [ ] Checkout with Khalti works
- [ ] Order appears in Admin Panel immediately (real-time)
- [ ] Admin can assign to Seller → Seller receives notification
- [ ] Admin can assign to Rider → Rider receives job ping
- [ ] Customer can track rider live on map
- [ ] Order completes and customer can review

### Service Booking Flow
- [ ] Customer can book Vet / Grooming / Hostel
- [ ] Booking appears in Admin as "AWAITING_ADMIN"
- [ ] Admin assigns to provider
- [ ] Provider receives booking in Partner App
- [ ] Provider confirms → Customer notified
- [ ] Vet can view + update pet health record after consultation
- [ ] Customer sees updated health record

### Pet Health
- [ ] Customer can view pet health dashboard (App + Web)
- [ ] Customer can add weight, allergies
- [ ] Vet can view pet health in Partner App
- [ ] Vet can add consultation notes
- [ ] Vaccination reminders trigger notifications
- [ ] PDF report can be downloaded

### Maps
- [ ] Customer App: shows nearby vets, live rider tracking
- [ ] Customer Web: shows nearby vets, live rider tracking
- [ ] Partner App: shows assigned pickup/drop locations
- [ ] Admin Panel: live map of all riders + orders

### Real-Time
- [ ] Admin gets real-time notification on new order
- [ ] Admin gets real-time notification on new booking
- [ ] Rider gets "job available" ping
- [ ] Customer gets order status updates
- [ ] Chat works Customer ↔ Vet (App + Partner App)

### Feature Parity (Web = App)
- [ ] All 15+ features listed in Phase 7 are present on Website

---

## 📋 COMMIT STRATEGY FOR CURSOR

After completing each Phase, commit with:
```
git add .
git commit -m "Phase X complete: [description]"
```

| Phase | Commit Message |
|-------|---------------|
| 0 | `feat: global brand color #703418 injected across all platforms` |
| 1 | `feat: auth unification — Google, OTP, email verify, Khalti` |
| 2 | `feat: map system unified across customer app, web, partner app, admin` |
| 3 | `feat: product order chain — admin assign seller and rider workflow` |
| 4 | `feat: service booking chain — admin assigns provider, partner confirms` |
| 5 | `feat: pet health tracking — bi-directional sync customer and vet` |
| 6 | `feat: real-time socket hub — notifications, chat, rider tracking` |
| 7 | `feat: customer web feature parity with app` |
| 8 | `feat: care+ subscription plans and shop UI polish` |
| 9 | `feat: push notifications FCM for all user roles` |
| 10 | `security: api auth, cors, env audit` |
| 11 | `chore: final validation checklist pass` |

---

## 🚨 KNOWN GAPS TO WATCH FOR

1. **Data Dictionary anomaly:** The data dictionary includes `HALL_OF_FAME` and `DONOR` roles — these appear to be from a different project template. **IGNORE these** unless they are actually used in PawSewa. Verify before implementing.

2. **Partner App role detection:** The Partner App serves 4 different user types (Rider, Seller, Vet, Hostel Owner). Use `user.role` from JWT to conditionally show the correct dashboard.

3. **Khalti is Nepal-specific:** Ensure sandbox keys are used in development. Production keys require business verification.

4. **Map API costs:** Google Maps charges per load. For development, use OpenStreetMap + Leaflet as fallback if no Maps API key is available.

5. **Socket.io and React Native:** Use `socket.io-client` version compatible with your server. Force websocket transport on mobile: `{ transports: ['websocket'] }`.

---

