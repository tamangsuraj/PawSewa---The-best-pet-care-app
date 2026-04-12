# PawSewa — Technical Architecture & Viva Preparation

This document describes the end-to-end architecture, data flows, and responsibilities of major components in **PawSewa**, a multi-platform pet-care ecosystem. It is written for oral examination (viva/defense) at Bachelor of Science (Hons) in Computing level.

---

## 1. System Overview & Technology Stack

### 1.1 High-level architecture

PawSewa follows a **client–server architecture** with a **single authoritative REST API** and **real-time overlays** for operational dashboards and partner workflows.

| Layer | Technology | Role |
|--------|------------|------|
| **Customer mobile** | Flutter (`apps/mobile/user_app`) | Product discovery, cart, Khalti checkout, care bookings, chat, push notifications |
| **Partner mobile** | Flutter (`apps/mobile/vet_app`) | Veterinarians, riders, shop owners, and care-centre operators in one installable app, gated by **server-side role** |
| **Admin web** | Next.js (`apps/web/admin`) | Operations: live cases, orders, assignments, catalogue management |
| **Public/marketing web** | Next.js / shared libs (`apps/web/website`) | Customer-facing web surfaces where applicable |
| **Backend** | Node.js + Express (`backend/src/server.js`) | REST API under `/api/v1`, JWT auth, business rules, MongoDB persistence |
| **Database** | MongoDB Atlas | Document store; one logical database name enforced in application configuration |
| **Real-time** | Socket.io | Rooms per user and admin; event-driven UI refresh without full page reload |

Cross-cutting concerns include **Helmet** (HTTP security headers), **CORS** (origin policy for browsers and tunnels), **express-mongo-sanitize** (injection hardening), **rate limiting** on sensitive routes, and **structured logging**.

### 1.2 Ngrok as a development / demo tunnel

**Ngrok** exposes the local Express server (typically port `3000`) on a public HTTPS URL so physical devices and external services (e.g. payment gateways) can reach the API without LAN configuration.

**Problem:** Ngrok’s free tier may inject an **HTML “browser warning” interstitial** instead of forwarding JSON or WebSocket traffic. That breaks API clients that expect `application/json`.

**Mitigation — `ngrok-skip-browser-warning`:** Clients send the custom header `ngrok-skip-browser-warning: true` on HTTP requests and, where applicable, on Socket.IO handshakes. The backend explicitly **whitelists** this header in CORS (`allowedHeaders` / `exposedHeaders`) and in the Socket.IO server configuration so **OPTIONS preflight** and polling transports succeed through the tunnel.

**Representative locations:**

- **Backend:** `backend/src/server.js` — CORS shared config and Socket.IO `allowedHeaders` include `ngrok-skip-browser-warning`.
- **User app:** `apps/mobile/user_app/lib/core/api_client.dart` — Dio interceptor sets the header on every request; response handler rejects HTML bodies that indicate the interstitial.
- **Partner app:** `apps/mobile/vet_app/lib/core/api_client.dart`, `socket_service.dart`, `payment_webview_screen.dart` — same pattern; Khalti WebView also sets a distinct **User-Agent** to reduce interception.
- **Admin:** `apps/web/admin/lib/api.ts`, `lib/socket.ts`, `app/cases/page.tsx` — Axios defaults and Socket.IO `extraHeaders`.

This is a **tunnel-aware integration** pattern: the system remains protocol-correct (JSON over REST, Socket.IO over WS/polling) while accommodating Ngrok’s edge behaviour.

---

## 2. Detailed File & Module Responsibilities

> **Note on filenames:** Some literature or earlier drafts refer to `app.js`, `api_provider.dart`, `src/api/apiClient.ts`, or `LiveCases.tsx`. In this repository, the **actual entry points and names differ**; the mappings below align with the current tree.

### 2.1 Backend — Express application bootstrap

**Primary file:** `backend/src/server.js` (not `app.js`)

- **Middleware stack:** Helmet, conditional Morgan logging, CORS (development permissive or production whitelist via `ALLOWED_ORIGINS`), JSON/urlencoded body parsers (size limits), MongoDB operator sanitization, global API rate limiter, DB request context, API logging, `requireDb` guard for `/api/v1`.
- **HTTP server:** `http.createServer(app)` shared with Socket.IO.
- **Route mounting:** Namespaced under `/api/v1/...` (users, pets, auth, cases, service-requests, admin, payments, orders, products, care-bookings, etc.).
- **Socket.IO registration:** Imports from `backend/src/sockets/` (e.g. `socketAuth.js`, `chatHandler.js`, `vetDirectSocket.js`), calls `setIO(io)` for emit helpers.

**Supporting directories:**

| Path | Responsibility |
|------|----------------|
| `backend/src/routes/` | Express routers: map HTTP verbs and paths to controllers; compose `protect`, `authorize`, upload middleware. |
| `backend/src/controllers/` | **Business logic** and orchestration: validate input, call models/services, emit Socket.io events, return JSON. |
| `backend/src/models/` | **Mongoose schemas**: Users, Orders, Payments, Cases, CareBooking, Hostel, etc.; indexes (including **2dsphere** where needed). |
| `backend/src/middleware/` | **Cross-cutting:** `authMiddleware.js` (JWT `protect`, role checks), rate limits, error handling, DB availability. |
| `backend/src/sockets/` | **Real-time:** authentication middleware for sockets, chat/marketplace/vet/call handlers, `socketStore.js` (`getIO` / `setIO`). |

There is **no** `socket/socket.js` at repo root; real-time logic is modular under `backend/src/sockets/`.

### 2.2 User app (Flutter)

| Requested / actual | Purpose |
|--------------------|---------|
| `lib/core/api_provider.dart` | **Not present.** Networking is implemented in **`lib/core/api_client.dart`** (singleton Dio client, interceptors, JWT attachment, Ngrok handling). |
| `lib/providers/` | **Not present as a folder.** State uses **`provider`** package with **`ChangeNotifier`** classes registered in `lib/main.dart` (e.g. `CartService`, `SavedAddressesService`, unread counters). |
| `lib/screens/checkout/` | **Not present.** Checkout UX lives in **`lib/screens/shop/shop_screen.dart`** (basket, `_CheckoutSheet`, promo, payment routing) and **`lib/screens/shop/khalti_payment_screen.dart`** (WebView-based Khalti flow with Ngrok headers). |

**`CartService`** (`lib/cart/cart_service.dart`): in-memory cart, delivery coordinates/address notes — the **domain state** for shop checkout before the API persists an order.

### 2.3 Admin panel (Next.js)

| Requested / actual | Purpose |
|--------------------|---------|
| `src/api/apiClient.ts` | **Actual path:** `apps/web/admin/lib/api.ts` — centralized Axios instance with base URL from env, **JWT** from storage, and **Ngrok bypass** on every request. |
| `src/pages/LiveCases.tsx` | **Actual path:** `apps/web/admin/app/cases/page.tsx` — **Live Cases** page: fetches `/cases` and `/service-requests`, listens to Socket.io events (`case_status_change`, `service_request_status_change`, `care_booking:new`, `new_hostel_booking`) to **refetch** without manual refresh. |

### 2.4 Partner app (Vet / Rider / Care centre) — single codebase, role separation

**Mechanism:** After login, the API returns a **normalized `role`** string. The app:

1. **Rejects** disallowed roles (e.g. customer, admin) in `vet_app/lib/screens/login_screen.dart` via `_allowedRoles`.
2. Maps the server role to a **partner panel** in `vet_app/lib/core/partner_role.dart`:
   - `rider` → rider-only UI
   - `shop_owner` → seller panel
   - `veterinarian` / `vet` → vet panel
   - `care_service`, `hostel_owner`, `groomer`, `trainer`, `facility_owner`, `service_provider` → **care** panel

3. **`VetDashboardScreen`** branches dashboards and widgets by `_userRole` (stats grids, `RiderHomeAssignedOrdersPanel`, `VetHomeAssignedAppointmentsPanel`, care panels, etc.).

Thus **one Flutter application binary** serves multiple professional personas through **authorization-driven UI composition**, not separate APKs per role.

---

## 3. Major Logic Flows (Step-by-Step)

### 3.1 Product / order flow (cart → Khalti → admin → rider)

1. **Browse & cart:** User adds products in the shop UI; `CartService` holds line items and delivery metadata.
2. **Checkout:** User opens checkout from `shop_screen.dart`; address, promo, and payment method are collected client-side.
3. **Khalti path (deferred order):** For Khalti, the backend can create a **Payment** record and **defer** final `Order` creation until the gateway reports success (`orderController` logic around `isKhaltiDeferred`). Initiation endpoints include routes such as `POST /api/v1/orders/checkout/khalti/initiate` (see `orderRoutes.js` / `orderController.js`).
4. **Payment UI:** `KhaltiPaymentScreen` loads Khalti’s `payment_url` in a WebView with Ngrok-friendly headers and success URL detection.
5. **Verification:** Khalti callback and lookup flows (`paymentController.js`, `GET /api/v1/payments/khalti/callback`, verify endpoints) finalize payment and create/update the order atomically where implemented (`shopCheckoutKhalti.js` service).
6. **Real-time fan-out:** `orderSocketNotify.js` uses `getIO()` to emit `orderUpdate`, `new:order`, `order:paid`, and on assignment `job:available` / `order:assigned_rider` to **`admin_room`** and specific **`user:<id>`** rooms.
7. **Admin visibility:** Admin dashboards consume REST + Socket.io; financial/list views may use `adminRoutes` aggregations (e.g. Khalti-paid orders).
8. **Rider:** Riders receive **`job:available`** or assignment events on their user room; the partner app uses **swipe actions** (e.g. `rider_delivery_orders_screen.dart`, `swipe_action_button.dart`) to advance delivery state, with maps using `flutter_map`’s **`MapController`** for live map control.

### 3.2 Hostel / care booking flow (GeoJSON, indexing, notifications)

**Geospatial data model**

- **Care bookings** may include **pickup** logistics with a **GeoJSON Point**:  
  `{ type: 'Point', coordinates: [longitude, latitude] }`  
  (MongoDB convention: **lng first**, then **lat**.)

- **Schema design (`CareBooking` model):** `pickupAddress` is stored as **Mixed** so Mongoose does not auto-instantiate an incomplete Point (which would break geo indexing). A **partial 2dsphere index** on `pickupAddress.point` only applies when coordinates exist — avoiding *“Can’t extract geo keys”* errors from malformed or empty geometries.

- **Validation hook:** `stripInvalidPickupGeo` pre-validate hook clears invalid pickup geo when `logisticsType === 'pickup'`, and uses a safe default for self-drop scenarios as defined in the model.

**Notifications to care centre / partners**

- On new or updated bookings, `careBookingSocketNotify.js` emits:
  - `care_booking:new` / `new_hostel_booking` to **`admin_room`**
  - Same to **`user:<hostelOwnerId>`** (care partner) and **`user:<customerId>`**
  - Updates and assignments to relevant rooms

The **Admin Live Cases** page subscribes to `care_booking:new` and `new_hostel_booking` to refresh lists — aligning operational visibility across web admin and partner clients.

*Note:* The **`Hostel`** listing model uses human-readable `location.coordinates.lat/lng` for listings; **operational geo** for routing/booking pickup follows GeoJSON Points where indexed — both patterns coexist for UX vs. analytics/query needs.

### 3.3 Veterinarian flow (test accounts vs. professional onboarding, receiving requests)

**Account creation paths**

- **Simplified / demo-style accounts** can be seeded or created via administrative scripts and role assignment (see `backend` seeders / demo scripts) for rapid testing of assignments and dashboards.
- **Professional onboarding** for providers may include **`ProviderApplication`** (`providerApplicationController.js`): providers submit business details; **admin review** sets `approved`/`rejected` and can flip verification flags on the `User` record (e.g. `businessLicenseVerified`).

**Receiving service work**

- **Assistance cases** and **service requests** (appointments) are exposed via dedicated controllers; status transitions emit Socket.io events such as **`case_status_change`** (`caseController.js`) and **`service_request_status_change`** (`serviceRequestController.js` → `admin_room`).
- The **partner vet UI** loads assignments via REST (e.g. `getMyAssignments`) and shows **swipe-driven** status transitions in screens like `vet_assigned_appointments_screen.dart`, backed by `vet_visit_swipe_flow.dart`.

---

## 4. Advanced Technical Implementation

### 4.1 Database design — single logical database

The backend enforces a **single logical database name** (see `EXPECTED_DB_NAME` and `getConfiguredDbName()` in `backend/src/config/db.js`, currently aligned with **`pawsewa_core`**). Historical migration scripts in `backend/scripts/` reference legacy names such as `petcare` or `pawsewa_dev`; the **production intent** is **consolidation** into one Atlas database to:

- Avoid **split-brain** data (orders vs. users in different DBs)
- Simplify **backups**, **indexes**, and **referential** consistency via ObjectId references across collections (`User` ↔ `Order` ↔ `Pet`, etc.)

**Collection interaction (conceptual):**

- **`users`** — identity, role, tokens for FCM, profile fields.
- **`orders` / `payments`** — commerce state machine; Khalti transaction IDs stored on the order/payment documents.
- **`cases` / `servicerequests`** — field assistance vs. scheduled visits; drive vet and admin queues.
- **`carebookings` / `hostels`** — boarding and care services; pickup geo on bookings when applicable.
- **`products` / `reviews` / `favourites`** — catalogue and engagement.

### 4.2 Real-time updates (Socket.io)

**Pattern:**

1. HTTP request mutates authoritative state in MongoDB.
2. Controller or service obtains the singleton **`io`** via `socketStore.getIO()`.
3. Server **emits** to:
   - **`admin_room`** (joined by admin sockets after JWT auth in `server.js`)
   - **`user:<mongoUserId>`** (per-user rooms for customers, riders, partners)

**Examples:**

- **Orders:** `orderSocketNotify.broadcastShopOrder` — `orderUpdate`, `new:order`, `order:paid`, rider assignment events.
- **Vet / service:** `case_status_change`, `service_request_status_change`.
- **Care:** `care_booking:update`, `care_booking:new`, `new_hostel_booking`.

Clients (admin Next.js page, Flutter apps) **listen** and trigger **REST refetch** or patch local state — achieving **instantaneous operational awareness** without requiring users to manually refresh.

### 4.3 Authentication — JWT flow

1. **Login / OTP / OAuth** handlers verify credentials (e.g. `userController`, `authOtpController`, `authRoutes`).
2. On success, **`generateToken(userId)`** (`backend/src/utils/generateToken.js`) issues a JWT:
   - Payload: `{ id: userId }`
   - Signed with `process.env.JWT_SECRET`
   - **Expiry:** 30 days (configured in `expiresIn`)
3. Clients store the token (secure storage on mobile; local storage pattern on admin web).
4. **Protected routes** use middleware **`protect`**: read `Authorization: Bearer <token>`, **`jwt.verify`**, load `User` from DB, attach **`req.user`**, then run role-specific **`authorize(...)`** as needed.

This is a **stateless session** model: scalability is straightforward because each request is self-contained, with optional Socket.IO **auth** bridging the same identity into real-time channels.

---

## 5. Anticipated Viva Questions (with concise technical answers)

### How do you handle geographic data in MongoDB?

**Answer:** We store locations as **GeoJSON** where geospatial queries or indexing are required — e.g. **`Point`** with **`coordinates: [longitude, latitude]`**. We create **`2dsphere`** indexes on the embedded path (e.g. `pickupAddress.point`, `deliveryLocation.point`). For **CareBooking**, we use a **partial index** and **Mixed schema typing** so we do not persist malformed Points, preventing MongoDB geo indexing errors at insert time.

### How do you ensure data consistency across four different platforms?

**Answer:** All clients are **thin**: they talk to the **same Node.js API** and the **same MongoDB database**. Business rules live **once** in controllers/services; mobile and web only render state and collect input. Real-time events **reflect** server-side changes but do not replace the database as the source of truth.

### What was one of the biggest technical challenges?

**Answer:** **Tunneling with Ngrok** required systematic **`ngrok-skip-browser-warning`** handling across REST, Socket.IO (including CORS preflight), and **WebView-based Khalti** flows — otherwise responses became HTML interstitials instead of JSON. A second complexity was **map-heavy partner UX** (**`MapController`** lifecycle in FlutterMap, rider/vet screens) alongside **swipe-based** state transitions — ensuring map state and network calls stay coherent during navigation.

### Why Socket.io instead of only REST polling?

**Answer:** Operational roles (admin dispatch, riders, vets) need **low-latency** updates. Socket.io provides **bidirectional**, room-targeted pushes (`admin_room`, `user:<id>`), reducing load versus constant polling and improving perceived responsiveness.

### How are payments secured end-to-end?

**Answer:** Sensitive operations use **server-side secrets** (`KHALTI_SECRET_KEY`), **HTTPS** via Ngrok or production URLs, and **lookup/callback** verification against Khalti’s API. Amounts follow gateway rules (e.g. paisa). The mobile WebView does not trust client-side success alone — the **backend verification** path confirms settlement.

---

## 6. Quick reference — canonical paths

| Concern | Path |
|--------|------|
| API entry | `backend/src/server.js` |
| JWT | `backend/src/utils/generateToken.js`, `backend/src/middleware/authMiddleware.js` |
| Orders + Khalti | `backend/src/controllers/orderController.js`, `paymentController.js`, `services/shopCheckoutKhalti.js` |
| Order sockets | `backend/src/services/orderSocketNotify.js` |
| Care booking sockets | `backend/src/services/careBookingSocketNotify.js` |
| User HTTP client | `apps/mobile/user_app/lib/core/api_client.dart` |
| Khalti WebView | `apps/mobile/user_app/lib/screens/shop/khalti_payment_screen.dart` |
| Admin API client | `apps/web/admin/lib/api.ts` |
| Live Cases UI | `apps/web/admin/app/cases/page.tsx` |
| Partner role mapping | `apps/mobile/vet_app/lib/core/partner_role.dart` |

---

*Document generated from the PawSewa repository structure and implementation as of the authoring date. For examination, emphasize **single source of truth (API + DB)**, **JWT + role authorization**, **GeoJSON + 2dsphere discipline**, and **Ngrok-aware HTTP/WebSocket headers**.*
