# TECH.md — PawSewa Platform Engineering Deep Dive

**Document class:** Technical architecture specification  
**Audience:** Final-year project documentation, architecture presentations, technical viva, developer onboarding, production planning  
**Implementation truth:** [CLAUDE.md](CLAUDE.md), `backend/src/`, `apps/`  
**Version:** 2.0 · May 2026 (aligned with current codebase)

---

## 1. Executive Technical Overview

### 1.1 What the system is

PawSewa is a **multi-sided operational platform** for pet care in Nepal. It is not a single consumer application with a thin API. The engineering model treats the product as an **operations system** that must simultaneously support:

- Pet owners booking home visits, shopping, Care+ facility bookings, subscriptions, and chat
- Partners (veterinarians, riders, shop owners, care providers) executing assigned work in one mobile binary
- Administrators dispatching vets and riders, reconciling payments, auditing actions, and monitoring live operations
- A public website for discovery and checkout in the browser

All of these surfaces read and write through **one MongoDB dataset** and **one Node.js HTTP process** that also hosts Socket.io. That consolidation is intentional for the current startup phase.

### 1.2 Architectural objectives

- **Single domain truth:** One schema for users, pets, orders, service requests, payments, and notifications avoids split-brain between “shop” and “vet” services during rapid product iteration.
- **Traceable operations:** Bookings, orders, admin mutations, and payments must be reconstructable later (status fields, `PaymentLog`, immutable `AuditLog`, in-app `Notification` records).
- **Role-safe multi-tenancy:** The partner app is one APK with multiple UIs; authorization must be enforced on the server, not only hidden in Flutter widgets.
- **Nepal-specific constraints:** Khalti payments, Kathmandu Valley geofence for MVP home visits, tunnel-based mobile development, intermittent mobile networks.
- **Resilience over notification perfection:** Core entities must persist even when FCM or email side effects fail.

### 1.3 Four client surfaces

| Surface | Path | Default port | Primary users |
|---------|------|--------------|---------------|
| Backend API | `backend/` | 3000 | All clients |
| Customer website | `apps/web/website/` | 3001 | Pet owners (browser) |
| Admin dashboard | `apps/web/admin/` | 3002 | Operations / admin |
| User app (Flutter) | `apps/mobile/user_app/` | — | Pet owners only |
| Partner app (Flutter) | `apps/mobile/vet_app/` | — | Vets, riders, sellers, care partners |

The HTTP server binds **`0.0.0.0`** so physical devices on the LAN can reach the API during development (`server.listen(PORT, '0.0.0.0')`).

### 1.4 Centralized backend philosophy

- **REST (`/api/v1`)** is the authoritative channel for creates, updates, payments, and admin bulk reads.
- **Socket.io** on the same process provides sub-second fan-out for visit status, chat, and admin live views.
- **Firebase** is used **only for FCM push** and shared Google OAuth client configuration. There is **no Firestore** and no Firebase Authentication as the data layer.
- **JWT** in the `Authorization: Bearer` header is the session model for all protected REST and socket connections.

### 1.5 Why this shape fits a startup

- Small team can ship cross-cutting features (booking + admin assign + vet swipe) in one PR.
- One payment audit trail and one RBAC implementation.
- Operational cost of one deployable API artifact is lower than operating several microservices before load justifies the split.
- Tradeoff accepted: larger blast radius on deploy, Socket.io scaling coupled to API instances, and controller-level coupling to Mongoose models.

---

## 2. System Architecture Deep Dive

### 2.1 Client–server communication model

- Clients **never** communicate with each other; all coordination is mediated by the backend.
- **Synchronous path:** Client sends HTTP request with JWT → Express route → controller → Mongoose → JSON `{ success, data }` or `{ success: false, message }`.
- **Real-time path:** After login, client opens Socket.io connection with the same JWT in `handshake.auth.token` or `Authorization: Bearer`. Server validates, joins user to rooms, emits events on state changes.
- **Push path:** After durable writes, backend may call Firebase Admin SDK. Delivery is best-effort; clients must not treat push as the only source of truth.

### 2.2 REST architecture role

- Versioned base path **`/api/v1`** allows mobile store builds to lag backend deploys.
- Typical response envelope: `{ success: true, data: ... }` or error with `message` string.
- Idempotent-friendly reads; writes use explicit HTTP status codes (409 for booking slot conflicts, 403 for expired JWT, 401 for invalid token).
- Rate limiting via `generalApiLimiter` on `/api/v1` and `authLimiter` on auth routes.
- `requireDb` middleware fails fast when MongoDB is disconnected.
- `GET /api/v1/health` returns `status`, `database` name, `userCount`, and `environment` for cross-client sanity checks.

### 2.3 Socket.io architecture role

- Socket.io shares the **same HTTP server** as Express (Engine.IO with WebSocket and polling fallback).
- On connection: `socketAuthMiddleware` verifies JWT, loads user, joins `user:<userId>`; admins also join `admin_room`.
- Registered handlers: `chatHandler`, `customerCareSocket`, `marketplaceChatSocket`, `vetDirectSocket`, `callSignalingSocket`, `unifiedChatSocket`.
- Pet medical updates: clients emit `join_pet_room` with `{ petId }`; server joins socket to `pet_<petId>`; clinical saves emit `pet_medical_record_updated`.
- Service request status changes emit `status_change` to request-scoped and user-scoped rooms via `emitStatusChange` in `serviceRequestController.js`.
- CORS for sockets mirrors REST policy and explicitly allows `ngrok-skip-browser-warning` for tunnel development.

### 2.4 Shared backend model (logical service boundaries)

Within the monolith, domains are **organizational modules**, not separate network services:

- **Identity & users** — JWT, roles, profiles, deactivate/reactivate, FCM token storage
- **Pets & health** — CRUD, medical history projection from `ServiceRequest` and linked visits
- **Service requests** — Home visit lifecycle, notifications, zone assignment
- **Commerce** — Products, orders, promos, rider assignment, stock filtering
- **Care marketplace** — `Hostel` listings, `CareBooking`, grooming/training requests
- **Payments** — Khalti initiate/verify, `PaymentLog`, centralized `payment_config.js`
- **Communications** — Multiple chat channels plus Agora call signaling
- **Admin operations** — Live map, assignment, zones, service catalogue, audit log, revenue report

Modules call Mongoose models directly. Boundaries are enforced by convention and review, not by container isolation.

### 2.5 State consistency strategy

- **Server-authoritative:** The database state after a successful HTTP response is the contract.
- **Eventual on clients:** Socket events and FCM may arrive late or be missed when the app is backgrounded; screens use pull-to-refresh and reconnect handlers.
- **Dual notification persistence:** `Notification` collection (in-app inbox) plus FCM (OS alert). In-app works when push is denied.
- **No distributed transactions across services** — single MongoDB scope for a request’s writes.

### 2.6 Why microservices were deferred

- Team size and transaction volume do not yet justify operational overhead of service mesh, contract testing, and sagas for order+payment.
- Admin live map and cross-domain reports benefit from single-database joins.
- Nepal MVP requires fast iteration on booking rules, geofence, and Khalti flows in one codebase.

**Future split candidates:** notification worker, payment webhook ingester, dedicated socket gateway when connection count or CPU forces it.

### 2.7 Architecture tradeoffs (summary)

**Strengths:** single domain model, unified auth, fast feature delivery, one tunnel URL for mobile QA.  
**Costs:** Socket scale tied to API process, deploy blast radius, module coupling through shared models, eventual consistency burden on mobile clients.

---

## 3. Monorepo Engineering Strategy

### 3.1 Repository layout

- `backend/src/` — Node.js Express application (entry `server.js`)
- `apps/mobile/user_app/` and `apps/mobile/vet_app/` — separate Flutter products and bundle IDs
- `apps/web/website/` and `apps/web/admin/` — separate Next.js apps on ports 3001 and 3002
- `shared/types/` — TypeScript interfaces for web alignment
- `shared/models_dart/` — partial Dart models (can drift from API)

### 3.2 Shared development philosophy

- One clone contains full-stack context for a feature (e.g. booking + vet assignment + admin panel).
- Root `npm run dev` can orchestrate backend + both web apps via `concurrently`.
- Documentation triad: `CLAUDE.md` (agent/onboarding), `TECH.md` (architecture), `README.md` (runbook).

### 3.3 Dependency management

- **Backend:** `backend/package.json` — Express 5, Mongoose, Socket.io, Firebase Admin, axios (Khalti, Google userinfo), etc.
- **Web:** Independent `package-lock.json` per Next app; admin includes `html2pdf.js` for revenue report export.
- **Mobile:** Independent `pubspec.yaml` per app; Dio, Provider, socket_io_client, firebase_messaging.

### 3.4 Development efficiency enablers

- `npm run tunnel` in backend exposes port 3000 via ngrok for device testing.
- User app “Set server URL” on login stores host or full ngrok URL.
- `flutter run --dart-define=API_HOST=<host>` for compile-time override.
- Android emulator path uses `10.0.2.2` when `AppConstants.kUseEmulator` is true in user app.
- `node backend/scripts/check-db.js` verifies Mongo connection and collection counts.

### 3.5 Deployment implications

- **Backend:** Single Node process (or horizontal replicas behind load balancer later). Env-driven: `MONGO_URI`, `JWT_SECRET`, `BASE_URL`, `KHALTI_SECRET_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ALLOWED_ORIGINS`.
- **Web:** Static/SSR deploy per Next app; `NEXT_PUBLIC_API_URL` must match backend.
- **Mobile:** Store releases decoupled from backend deploy cadence; API must stay backward compatible within `/api/v1`.

### 3.6 CI/CD implications (recommended, not fully wired)

- Lint: ESLint on backend and web; `flutter analyze` per app.
- Smoke: `backend/test-api.js`, performance assets under `backend/tests/performance/`.
- Secrets: never commit `.env`; scan in CI.
- Database promotion: explicit `DB_NAME` discipline documented in `DATA_GUIDE.md`.

### 3.7 Monorepo drawbacks

- Large working tree if build artifacts are not gitignored.
- Unrelated client changes can land in one PR without discipline.
- No per-service versioning — old app store builds depend on API backward compatibility.

### 3.8 Future modularization

- OpenAPI spec with generated Dart/TS clients when API stabilizes.
- Extract `packages/api-contracts` npm module.
- Optional split of notification and payment workers when load profile demands it.

---

## 4. Backend Engineering Architecture

### 4.1 Process and entry point

- `backend/src/server.js` loads `dotenv`, connects MongoDB (`connectDB` + `startBackgroundReconnect`), creates Express app and HTTP server, attaches Socket.io, registers middleware and routes, starts background jobs, listens on `0.0.0.0:PORT` (default 3000).
- `setIO(io)` via `sockets/socketStore.js` lets controllers emit without passing `io` through every function signature.

### 4.2 Layering pattern

| Layer | Responsibility | Examples |
|-------|----------------|----------|
| Routes | HTTP mapping, middleware stacks | `serviceRequestRoutes.js`, `authRoutes.js` |
| Controllers | Validation, orchestration, status codes | `serviceRequestController.js`, `userController.js` |
| Services | Reusable domain logic | `customerCareService.js`, `shopCheckoutKhalti.js` |
| Utils | Cross-cutting helpers | `notificationService.js`, `zoneMatcher.js`, `auditLogger.js`, `fcm.js` |
| Models | Schema, indexes, pre-save hooks | `ServiceRequest.js`, `User.js` |
| Jobs | Scheduled side effects | `jobs/subscriptionReminder.js` |
| Constants | Shared enums | `serviceRequestStatus.js` |

Controllers are the primary orchestration layer. Extraction to services happens when duplication appears (payments, care booking).

### 4.3 Middleware pipeline (order matters)

1. `helmet` — secure HTTP headers  
2. `morgan('dev')` — request logging in development  
3. `cors` — development permissive `origin: *` when `ALLOWED_ORIGINS` unset; production whitelist via `ALLOWED_ORIGINS`  
4. `express.json` / `urlencoded` — 10mb cap (DoS mitigation)  
5. Custom sanitize — `express-mongo-sanitize` on **body and params only** (Express 5 `req.query` is read-only)  
6. `generalApiLimiter` on `/api/v1`  
7. `dbRequestContext` — request-scoped DB context  
8. `apiLogMiddleware` — API logging  
9. `requireDb` on `/api/v1`  
10. Route handlers  
11. `notFound` → `errorHandler`

Per-route: `protect`, `authorize('admin')`, `admin`, `adminOrShopOwner`, upload middleware, etc.

### 4.4 Async handling

- `express-async-handler` wraps controllers so rejected promises reach `errorHandler`.
- Controllers use `return res.status(4xx).json(...)` for expected failures or `res.status(4xx); throw new Error(...)` for global handler path.
- Stack traces included in error JSON only when `NODE_ENV !== 'production'`.

### 4.5 Side-effect isolation (critical pattern)

After `ServiceRequest.create()`, the controller runs notifications and zone auto-assignment inside a **try/catch**. Failure logs via `logger.warn` but **still returns HTTP 201** with the created request. This prevents the client from believing the booking failed when the row already exists (which would cause duplicate-slot 409 on retry).

Same philosophy should apply to other “create then notify” paths when added.

### 4.6 Notification orchestration

`utils/notificationService.js` centralizes:

- MongoDB `Notification` document creation (in-app inbox)
- FCM via `utils/fcm.js` (`sendMulticastToUser`, `sendMulticastToAdmins`)
- Typed `data` payloads for deep links (`service_request_created`, `appointment_assigned`, `appointment_accepted`, etc.)

Functions include: `notifyServiceRequestCreated`, `notifyAdminNewServiceRequest`, `notifyServiceRequestAssignment`, `notifyServiceRequestVisitStatusForOwner` (includes visit date in copy for accepted/declined states).

### 4.7 Audit logging

- `utils/auditLogger.js` writes `AuditLog` entries on admin mutations (e.g. `deactivate_user`, `reactivate_user`, service catalogue changes).
- Failures are swallowed so audit never blocks the primary operation — availability over strict audit completeness.

### 4.8 Centralized error handling

`errorMiddleware.js`:

- Normalizes status (avoids accidental 200 on thrown errors)
- Maps Cloudinary “Stale request” clock skew to actionable message
- Production hides stack traces

**Limitation:** No structured error codes (`ERR_BOOKING_SLOT`) for client branching yet — only string `message`.

### 4.9 Background jobs (in-process)

- **Reminder notifier:** `scanAndNotifyReminders24h` every 15 minutes when `ENABLE_REMINDER_NOTIFIER` is not `false`.
- **Subscription renewal reminders:** `runSubscriptionRenewalReminders` daily from `jobs/subscriptionReminder.js` — 30-day and 7-day FCM before `endDate`, flags `renewalReminder30Sent` / `renewalReminder7Sent` on `PetOwnerSubscription`.

These run in the API process today; a dedicated worker process would be the scale-out step.

---

## 5. Authentication & Authorization System

### 5.1 JWT authentication lifecycle

- **Issuance:** `loginUser`, OTP verify, Google auth paths sign JWT with user id via `generateToken.js`.
- **Transport:** `Authorization: Bearer <token>` on REST; same token on Socket.io handshake.
- **Validation:** `protect` middleware — `jwt.verify(JWT_SECRET)`, load user without password field.
- **Expiry:** `TokenExpiredError` → **403** with message “Session expired. Please log in again.”; invalid token → **401**.
- **Logout:** Client deletes token; server is stateless (no server-side session store).
- **Login block:** `loginUser` rejects users with `isActive === false` with 403 and support message.

### 5.2 Auth routes (`/api/v1/auth`)

- `POST /login` — email/password (rate-limited)
- `POST /forgot-password`, `POST /reset-password` — reset token hashed in DB, emailed via `sendEmail.js`
- `POST /send-otp`, `POST /verify-otp` — passwordless email OTP (MongoDB `loginOtp` fields)
- `POST /google` — Google ID token or access token via `resolveGoogleIdentity` (audience list from env or PawSewa defaults)

### 5.3 Role normalization

`normalizeRole()` in `authMiddleware.js` maps legacy values:

- `CUSTOMER` / `customer` → `pet_owner`
- `VET` / `vet` → `veterinarian`
- `ADMIN` → `admin`
- `RIDER` / `staff` → `rider`

`authorize('admin', 'veterinarian')` compares normalized role. `authorizeCarePartnerOrListingOwner` allows care partners with Hostel listings even if role string is nonstandard.

### 5.4 RBAC implementation

- Route-level: `protect` + `authorize(...)` or legacy `admin` middleware.
- **Public registration** forces `pet_owner` in `registerUser` — clients cannot self-provision admin or vet via public register endpoint.
- **Resource ownership:** Controllers must verify ownership (e.g. `pet.owner === req.user._id` on service request create). Role alone is insufficient.

### 5.5 Socket authentication parity

`socketAuthMiddleware` repeats JWT validation. Fast-fails if `mongoose.connection.readyState !== 1` to avoid misleading “invalid token” when DB is down. Distinguishes DB errors from bad tokens in error messages.

### 5.6 Security boundaries and risks

| Control | Implementation |
|---------|----------------|
| Password hashing | bcrypt on User model |
| Auth brute force | `authLimiter` |
| Input operator injection | mongoSanitize on body/params |
| CORS | Permissive only in dev without `ALLOWED_ORIGINS` |
| Deactivated users | Blocked at login; JWT may remain valid until expiry |

**Known gaps:**

- No refresh-token rotation or server-side revocation list on deactivate
- Pet subscription `POST /pet-subscriptions/subscribe` accepts `paymentRef` without Khalti server verification today (financial exposure before production monetization)
- Verbose request body logging in `createServiceRequest` should be disabled or redacted in production

**Future improvements:** short-lived access + refresh tokens, Redis denylist on deactivate, structured error codes, CAPTCHA on repeated auth failures.

---

## 6. Database Engineering (MongoDB)

### 6.1 Why MongoDB Atlas

- Heterogeneous entities (orders with line items, service requests with geo coordinates, hostel galleries) fit document embedding.
- Schema evolves with product without heavy SQL migrations during MVP.
- Atlas reduces operational burden for student/startup teams.
- Geospatial expansion possible via `2dsphere` later; current zones use district substring match and optional polygon arrays.

### 6.2 Tradeoffs vs PostgreSQL / MySQL

| MongoDB (chosen) | Relational alternative |
|------------------|------------------------|
| Flexible nested documents | Strong SQL for finance reports |
| App-enforced schema via Mongoose | DB-enforced constraints |
| Aggregation pipelines for admin | Ad-hoc SQL familiarity |
| Single-cluster simplicity | Mature replication tooling |

Accepted tradeoff: complex cross-domain finance reporting may eventually need warehouse ETL.

### 6.3 Core collections (current)

- `User` — roles, zone ref, FCM tokens (capped), addresses array, `isActive`, reset password fields
- `Pet` — PawID, weight history, reminders, medical history notes
- `ServiceRequest` — visit lifecycle, location, assigned staff, visit vitals, cancellation reason
- `Case` — emergency assistance
- `Order`, `Product`, `Category` — commerce; products filtered by `stockQuantity > 0` for shop listing
- `Hostel`, `CareBooking`, `CareRequest`, `CareStaffTask` — Care+
- `Appointment` — clinic flow
- `PetOwnerSubscription` vs `Subscription` — **different** — pet-owner plans vs provider vendor plans
- `Zone`, `ServiceCatalogue` — admin-configured operations
- `Notification`, `Payment`, `PaymentLog`, `AuditLog`
- Chat family: `Chat`, `VetDirectMessage`, `MarketplaceMessage`, `MarketplaceConversation`, etc.
- `CallSession` — Agora metadata

### 6.4 Indexing and performance

- Example: `serviceRequestSchema.index({ pet: 1, preferredDate: 1, status: 1 })` supports duplicate detection window queries.
- Example: `notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 })` supports inbox pagination.
- Production should run `explain()` on admin list and live-map queries as data grows.

### 6.5 Consistency challenges

- Status strings centralized in `serviceRequestStatus.js` — must keep Flutter `AppConstants.serviceRequestStatusLabels` aligned.
- Legacy role strings mitigated by `normalizeRole`.
- `DB_NAME` / migration history: wrong database name causes “empty shop” incidents (`DATA_GUIDE.md`).
- Two subscription models require naming discipline in code review.

### 6.6 Scaling path

- Vertical scale Atlas tier first
- Read replicas for reporting queries
- Archive cold completed requests after retention policy
- Shard by region only if multi-city expansion warrants it

---

## 7. Real-Time Communication System

### 7.1 Socket.io lifecycle

1. Client obtains JWT via REST login.
2. `SocketService.connect()` with `auth: { token }` (Flutter).
3. Server validates JWT, attaches `socket.user`, joins rooms.
4. Handlers registered from `server.js` on connection and via module `register*(io)`.
5. On disconnect, `presenceDisconnect` updates presence store.

### 7.2 Room model

- `user:<userId>` — user-targeted events
- `admin_room` — admin dashboards
- `pet_<petId>` — medical record updates (`join_pet_room` / `leave_pet_room`)
- Request/conversation-specific rooms per chat module
- `emitStatusChange` targets request and owner/staff channels for service requests

### 7.3 Key events

- `status_change` — service request status updates
- `pet_medical_record_updated` — clinical entry saved; includes `petId` in payload
- `case_status_change` — assistance cases
- Chat-specific events per handler module

### 7.4 Reliability concerns

- Mobile backgrounding kills sockets — clients must refetch on resume.
- No guaranteed delivery of socket events — REST remains truth.
- Single Node: max connections bounded by process memory/CPU.
- Multi-instance deploy requires Redis adapter + sticky sessions or equivalent.

### 7.5 Reconnection strategy (clients)

- Flutter reconnects on app resume; re-registers listeners in `initState`, removes in `dispose`.
- Pull-to-refresh on list screens as backup.

### 7.6 Future: Redis adapter

- `@socket.io/redis-adapter` for horizontal socket scale
- Dedicated socket gateway service optional later

### 7.7 WebRTC / Agora

- Voice/video through Agora SDK; `callSignalingSocket` for session setup
- Media does not flow through PawSewa servers except signaling metadata in `CallSession`

---

## 8. Push Notification Infrastructure

### 8.1 Architecture role

- Firebase Admin SDK in backend (`config/firebaseAdmin.js`, `utils/fcm.js`)
- **Not authoritative** for business state — only delivery transport
- If `FIREBASE_SERVICE_ACCOUNT_JSON` unset, push is disabled; in-app notifications still work

### 8.2 Token management

- Stored on `User.fcmTokens` array (max kept per user in controller logic)
- `onTokenRefresh` on mobile re-registers via user profile/FCM endpoints
- Multicast to all tokens for a user on notify

### 8.3 Dual persistence

- **`Notification` collection** — in-app list, read/unread, history, typed (`service_request`, `system`, etc.)
- **FCM** — OS-level alert when app backgrounded

### 8.4 Payload and deep linking

- FCM `data` values must be **strings**
- Typical fields: `type`, `id`, optional `date`, `status`, `petId`, `vetId`
- User app: `NavigationService.navigatorKey` + `buildNotificationRoute` in `push_notification_service.dart`
- Types include: `appointment_accepted`, `appointment_assigned`, `service_request_created`, `service_request_update`, `order_update`, `medical_record`, `chat_message`, `subscription_renewal`
- Unknown `type` falls back to notifications list screen

### 8.5 Reliability philosophy

- Push is **best-effort**
- Critical state must be reachable via REST
- FCM failures logged with `logger.warn`; must not roll back primary DB writes

### 8.6 Retry and failure

- No full outbox queue today — failed FCM after DB write is log-only
- Future: queue + retry worker for FCM/email

---

## 9. Payment System Architecture

### 9.1 Centralized configuration

`backend/src/config/payment_config.js` is the single source for:

- `KHALTI_BASE_URL` (sandbox default `https://dev.khalti.com/api/v2/`)
- `KHALTI_SECRET_KEY`, `KHALTI_PUBLIC_KEY`
- `nprToPaisa()` — Khalti amounts in paisa
- `isKhaltiConfigured()`, `getKhaltiMode()`
- `getPaymentFailureMessage(reason)` — consistent copy across apps
- `getServerBaseUrl()` — `BASE_URL` → `KHALTI_RETURN_BASE` → localhost fallback for callbacks

### 9.2 Khalti flow (orders and unified initiate)

1. Client creates order or payment record via REST.
2. Backend calls Khalti `epayment/initiate` with amount in paisa, return URL from `getServerBaseUrl()`.
3. Client opens `payment_url` (WebView on mobile, redirect on web).
4. After payment, Khalti redirects/callback hits backend `BASE_URL`.
5. Client calls `POST /payments/verify-payment` with `pidx`.
6. Backend Khalti lookup; on Completed, updates order/payment and appends `PaymentLog`.
7. Mobile `khalti_verify_helper.dart` retries and treats already-completed backend responses as success (idempotent client path).

### 9.3 Payment types supported in controller

- Shop orders
- Service requests (unified initiate)
- Care bookings (`initiateCareBookingKhalti`)
- Provider subscriptions (`initiateSubscriptionKhalti`)
- eSewa hooks exist for extensibility

### 9.4 Cash on delivery

- Service requests may use `paymentMethod: cash_on_delivery`
- Admin can assign vet before online payment — supports field operations in Nepal

### 9.5 Security and fraud

| Risk | Mitigation | Gap |
|------|------------|-----|
| Forged “paid” from client | Server-side Khalti lookup | — |
| Callback URL hijack | `BASE_URL` must match deployed/tunnel host | Misconfiguration common in dev |
| Amount tampering | Server computes from order lines | Custom amounts need review |
| Subscription without Khalti | — | `paymentRef` only required on subscribe — **must fix before production revenue** |

### 9.6 Reconciliation

- Admin **Payment Logs** page lists pidx, amount, status, type
- Ops compares Khalti dashboard ↔ `PaymentLog` ↔ order `paymentStatus`
- Future: automated daily reconciliation job

### 9.7 Order notification copy

- Out-for-delivery uses title “Your order is on the way!” with estimated delivery window in body (FCM + in-app)

---

## 10. Service Request Lifecycle System

### 10.1 Authoritative states

Defined in `backend/src/constants/serviceRequestStatus.js` and enforced on Mongoose `ServiceRequest.status` enum:

- `pending` — created, awaiting assignment
- `assigned` — vet linked (admin or zone auto-assign)
- `accepted` — vet confirmed they will perform visit
- `en_route` — vet traveling
- `arrived` — vet at location
- `in_progress` — visit underway
- `completed` — terminal success
- `cancelled` — terminal cancel
- `declined` — terminal; vet declined with `cancellationReason`

### 10.2 Business reasoning for granular states

- Home visits in Kathmandu traffic require owner-visible progress beyond binary “assigned/done”
- Reduces support calls (“where is the vet?”)
- Maps to owner-facing labels in `AppConstants.serviceRequestStatusLabels`
- Enables admin live map and vet swipe UI in partner app

### 10.3 Creation pipeline

| Step | Actor | Processing |
|------|-------|------------|
| 1 | Owner | `POST /api/v1/service-requests` with pet, serviceType, preferredDate, timeWindow, location |
| 2 | Model pre-save | Kathmandu Valley geofence; duplicate ±2 hour window per pet |
| 3 | Controller | `ServiceRequest.create` with `status: pending` |
| 4 | Side effects (try/catch) | `notifyServiceRequestCreated`, `notifyAdminNewServiceRequest`, optional `autoAssignVetByZone` |
| 5 | Response | HTTP 201 + populated request (pet, user, assignedStaff) |

**Duplicate guard:** Same pet cannot have overlapping active booking within ±2 hours of `preferredDate` (statuses excluding cancelled, completed, rejected, declined).

**serviceType enum on model:** `Appointment`, `Health Checkup`, `Vaccination` — client payloads must match.

### 10.4 Assignment paths

- **Zone auto-assign:** `zoneMatcher.js` resolves zone from address districts or polygon; picks vet in zone with fewest active requests; sets `assigned` and calls `notifyServiceRequestAssignment`
- **Admin assign:** `PATCH` assign endpoints under service-requests and admin namespace
- **No zone match:** Stays `pending`; message explains admin will assign

### 10.5 Status updates (`PATCH /api/v1/service-requests/status/:id`)

- Allowed transitions enforced in `updateServiceRequestStatus` — matrix of valid `(current → next)` pairs
- Assigned staff or admin may update
- `declined` sets `cancellationReason` from body `reason`
- Terminal states cannot be changed
- On accepted/en_route/arrived/in_progress/completed/declined: `notifyServiceRequestVisitStatusForOwner` with visit date in message where applicable
- `emitStatusChange` broadcasts to sockets
- On `completed`: may append visit notes to pet medical history and weight from `visitVitals`

### 10.6 Triggering actors

| Transition | Typical actor |
|------------|----------------|
| Create | Pet owner (app) |
| Assign | System (zone) or admin |
| Accept → complete | Assigned veterinarian (partner app swipe) |
| Decline | Assigned veterinarian (decline dialog with reason) |
| Cancel | Owner or admin |

### 10.7 Concurrency

- No optimistic locking version field on `ServiceRequest` today — last write wins on concurrent admin assign
- Vet accept vs admin cancel: second transition may 400; client must refresh
- Rare double-notify if assign races — acceptable at current scale

### 10.8 Failure scenarios

- Notify fails after create → booking exists; 201 returned; owner checks My Requests
- Invalid transition → 400 with message
- Outside geofence → 400 pre-save
- Duplicate slot → 409

---

## 11. Geo & Zone Assignment System

### 11.1 Kathmandu Valley geofence

Hard bounds in `ServiceRequest` pre-save (approx. lat 27.55–27.82, lng 85.18–85.55). Product decision: MVP service quality and logistics focus on valley. Expansion requires bounds update and staffing, not a feature flag alone.

### 11.2 Zone resolution (`utils/zoneMatcher.js`)

1. Load active `Zone` documents.
2. Match if any `districts` string appears in service address (case-insensitive).
3. Else if `polygonCoords` present, point-in-polygon test on lat/lng.
4. If no match → return **null** (no assignment).

**Engineering rule:** Never default to `zones[0]` — that caused incorrect vet assignment outside the matched area (fixed).

### 11.3 Auto-assign algorithm

- Find vets: role veterinarian, `zone` matches, `isAvailable`, `isVerified`, `isActive !== false`
- Count active service requests per vet (pending through in_progress)
- Assign to vet with minimum count (load balancing, not distance optimization)

### 11.4 Limitations

- Does not optimize travel distance — future: integrate live map distances
- Per-request O(vets) count queries — acceptable at dozens of vets; cache counts at scale
- District substring matching is fragile for ambiguous addresses — polygons preferred when admin maintains them

### 11.5 Future GIS improvements

- Admin UI for polygon editing
- PostGIS or MongoDB `2dsphere` queries
- Distance-aware assignment using rider/vet last known location from `StaffLocation` / `LiveLocation`

---

## 12. Flutter Mobile Engineering

### 12.1 Why Flutter (vs React Native)

- Single codebase per app for Android and iOS with strong map and animation performance for vet swipe UI
- Consistent rendering across Nepal device fragmentation
- Dart typing aligns with backend TypeScript mindset
- Team already invested in two Flutter apps (user vs partner), not four RN apps

### 12.2 User app architecture

- Entry: `main.dart` → `SplashScreen` → token validation via `getUserProfile` → `PetDashboardScreen`
- Bottom navigation: Home, Services, Shop, Care, My Pets
- Drawer: orders, appointments, clinic visits, care bookings, settings, notifications, profile
- HTTP: `ApiClient` (Dio) + `ApiConfig` (host, ngrok, emulator `10.0.2.2`, stored URL)
- State: Provider — `CartService`, unread notifiers, `OngoingCallService`
- Role guard at login: only `pet_owner` (legacy `CUSTOMER` mapped server-side)
- Push: `PushNotificationService` + `NavigationService` for cold-start deep links
- Theme: `pawsewa_theme.dart`, primary `#703418`

### 12.3 Partner app architecture

- Package: `pawsewa_partner`
- Entry: role-based routing to `PartnerHomeScreen` branches (vet, rider, shop_owner, care_service, etc.)
- Visit flow: `vet_assigned_appointments_screen.dart`, `vet_visit_swipe_flow.dart`, decline with reason → `status: declined`
- Maps: `flutter_map`, Google Maps directions helper, geolocator for live position
- Same Dio/JWT patterns as user app

### 12.4 Navigation and deep links

- Imperative `Navigator` + named routes for notification cold start
- `navigatorKey` global for FCM without `BuildContext`

### 12.5 Offline and performance

- No offline-first sync engine — error states with explicit Retry (e.g. medical history `PremiumEmptyState`)
- `cached_network_image` for remote photos
- Socket listeners scoped per screen; removed in `dispose`
- Large screens (e.g. shop) are maintainability hotspots for split widgets

### 12.6 Security note

UI role gating in vet app is **not** security. Every partner endpoint must enforce role and resource rules on server.

---

## 13. Web & Admin Architecture

### 13.1 Next.js 14 App Router

- **Website:** customer acquisition, shop, checkout — mix of SSR/CSR as appropriate for SEO
- **Admin:** authenticated internal tool, client-heavy dashboards after login

### 13.2 Admin operational surface (current pages)

Includes: dashboard (KPIs: today appointments, active subscriptions, today revenue), live-map, service-requests, appointments-desk, veterinarians, customers, riders, shops, care-services, care-inbox, zones, services (catalogue), reports (revenue + PDF export via html2pdf.js), audit-log, financials, payment-logs, transactions, promocodes, reminders, communication-center, marketplace-chats, customer-chats, pets, orders, settings.

### 13.3 API client

- `apps/web/admin/lib/api.ts` — axios, `NEXT_PUBLIC_API_URL`
- JWT attached from storage; same backend contract as mobile

### 13.4 Real-time on admin

- Socket.io client on select pages (e.g. live map) for staff/request pins
- Must use same JWT and CORS/tunnel rules as mobile

### 13.5 SSR vs CSR tradeoff

- Admin favors CSR after login for sockets and simpler token handling
- Public website pages can SSR for performance and SEO

### 13.6 Scalability

- Static assets via CDN; Next server scales horizontally
- Bottleneck remains backend API and MongoDB, not admin frontend

---

## 14. Messaging & Communication Ecosystem

### 14.1 Channel separation (intentional)

| Channel | Purpose | Backend module |
|---------|---------|----------------|
| Vet ↔ Owner | Visit-related direct chat | `vetDirectSocket`, `VetDirectMessage` |
| Customer care | Platform support | `customerCareSocket`, customer-care routes |
| Marketplace | Buyer ↔ seller on products | `marketplaceChatSocket` |
| Unified/legacy | General chat | `unifiedChatSocket`, `chatHandler` |

Separate models allow different moderation, retention, and metadata (order vs pet vs request). Unification cost is high; coexistence is manageable.

### 14.2 Synchronization

- Send via REST and/or socket depending on handler
- Recipient gets socket event → unread badge via Provider (mobile) or UI refresh (web)
- FCM if offline with `type: chat_message`
- Thread screen marks read via API

### 14.3 Vet chat eligibility

- `utils/vetChatEligibility.js` enforces business rules before chat is allowed (tied to service request relationship)

### 14.4 Uploads

- `POST /api/v1/chat/upload` (and alias) — Multer + Cloudinary for attachments

---

## 15. Error Handling & Reliability Engineering

### 15.1 HTTP errors

- Expected: explicit 4xx JSON from controllers
- Unexpected: `errorHandler` → 500, message string, no stack in production

### 15.2 Side-effect failures

- Post-create notify/assign wrapped in try/catch — core write succeeds
- Audit log failures swallowed
- FCM failures logged — continue

### 15.3 Database resilience

- `startBackgroundReconnect` on connection loss
- `requireDb` blocks API when DB down
- Socket auth returns “database reconnecting” instead of blaming user token

### 15.4 Graceful degradation

- Health endpoint reports `degraded` when Mongo disconnected
- Push disabled when Firebase not configured — app still functional
- Zone assign failure → pending request + informative message

### 15.5 Operational checklist

- Monitor 5xx rate on `POST /service-requests`
- Alert FCM failure spikes
- Track Mongo `readyState`
- Correlate `apiLogMiddleware` output in production

---

## 16. Performance Engineering

### 16.1 API

- Rate limits on general API and auth routes
- JSON body 10mb cap
- `.select()`, `.lean()` on read-heavy admin lists where safe
- Pagination on some list endpoints (ongoing hardening elsewhere)

### 16.2 Database

- Compound indexes on hot paths (notifications, service requests by pet/date/status)
- Avoid unbounded `find()` without skip/limit on large admin tables

### 16.3 Payload and media

- Cloudinary for uploads — offloads disk from API servers
- Product list filters `stockQuantity > 0` server-side to reduce useless client work

### 16.4 Mobile and web

- Image caching on Flutter
- ListView builders on long histories
- Admin dashboard aggregates (today revenue) use MongoDB aggregation pipelines

### 16.5 Notifications

- `sendEachForMulticast` for FCM batching per user token set

### 16.6 Load testing assets

- `backend/tests/performance/loginTest.jmx` — 50 users, login load
- `backend/tests/performance/healthRecordsTest.jmx` — medical history read load
- `backend/tests/performance/seedPerfUsers.js` — seeds perf accounts
- Documented in `README.md` Performance Testing section

---

## 17. Scalability Analysis

### 17.1 Current ceiling (honest)

- Single Node API + Socket: bounded by CPU and concurrent connections (low thousands of sockets typical before pain)
- MongoDB Atlas tier limits connection count and IOPS
- In-process cron jobs do not scale horizontally without leader election

### 17.2 Horizontal scaling path

- **REST:** Stateless behind load balancer — scale API replicas
- **Socket.io:** Requires Redis adapter (`@socket.io/redis-adapter`) or sticky sessions — **first infrastructure investment under load**
- **Background jobs:** Extract to worker process with queue (BullMQ, etc.)
- **Files:** Already on Cloudinary

### 17.3 Caching opportunities

- Zone list and service catalogue (Redis TTL)
- Product catalog read-through cache
- CDN for Next static assets

### 17.4 Microservice migration triggers

Split when team ownership and load justify ops cost:

1. Notification + email worker  
2. Payment webhook service (Khalti callbacks isolated)  
3. Socket gateway  

Until then, modular monolith boundaries in `backend/src/` suffice.

---

## 18. DevOps & Deployment Engineering

### 18.1 Environment management

Critical groups:

- **Data:** `MONGO_URI`, `DB_NAME` — wrong DB_NAME causes empty data or wrong credentials symptoms
- **Auth:** `JWT_SECRET`
- **Payments:** `KHALTI_SECRET_KEY`, `BASE_URL`, `KHALTI_BASE_URL`
- **Firebase:** `FIREBASE_SERVICE_ACCOUNT_JSON`
- **CORS:** `ALLOWED_ORIGINS` in production (dev defaults to permissive `*`)
- **Jobs:** `ENABLE_REMINDER_NOTIFIER`

### 18.2 Development tunnel pattern

- `npm run tunnel` → ngrok on port 3000
- Update `BASE_URL`, both Next.js `.env.local` files, and mobile stored URL together when URL rotates
- Documented extensively in `README.md` — top source of integration bugs

### 18.3 Production reference topology

- Reverse proxy (TLS termination) → Node cluster → MongoDB Atlas
- Flutter apps via app stores → same public API host
- Next.js on Vercel-like host or Node host
- External: Khalti, FCM, Cloudinary

### 18.4 Containerization recommendation

- Dockerfile for backend with healthcheck `GET /api/v1/health`
- Non-root user in container
- Separate deploy pipelines per artifact (API, website, admin, mobile)

### 18.5 Monitoring and logging

- Structured JSON logs via `utils/logger.js`
- APM for HTTP 5xx and latency (Datadog, New Relic, etc.)
- Atlas metrics for connections and slow queries
- Uptime ping on `/api/v1/health`

### 18.6 Backup and recovery

- Atlas continuous backup + periodic restore drill
- `AuditLog` immutable — legal/ops policy before truncation
- Migration scripts in `backend/scripts/` for operational fixes

---

## 19. Security Analysis

### 19.1 Threat surface

| Surface | Threats | Controls |
|---------|---------|----------|
| REST | IDOR, injection | JWT, sanitize, ownership checks |
| Auth | Brute force, token theft | Rate limit, secure storage on mobile |
| Admin | Privilege abuse | `authorize('admin')`, audit log |
| Socket | Unauthenticated subscribe | JWT on handshake |
| Payments | Fake verification | Khalti server lookup |
| Uploads | Malware | Cloudinary, type/size limits |

### 19.2 Data exposure

- Production must not return stack traces
- Admin endpoints return PII — admin-only gates required
- Reduce verbose body logging in production controllers

### 19.3 Known gaps (prioritize before scale)

1. Pet subscription without Khalti verify on subscribe  
2. JWT not revoked immediately on deactivate  
3. Dev CORS `*` when `ALLOWED_ORIGINS` unset — production must whitelist  
4. Role complexity — any missed server check on partner routes is high impact  

### 19.4 Future hardening

- WAF at edge  
- Refresh tokens + denylist  
- Structured audit export  
- Secret rotation runbooks for `JWT_SECRET` and Khalti keys  

---

## 20. Engineering Challenges & Lessons Learned

### 20.1 Cross-client API URL and database drift

- **Root cause:** Mobile LAN IP or ngrok vs web `localhost`; mismatched `DB_NAME` in `backend/.env`.
- **Impact:** Login failures, empty shop, “invalid credentials” despite valid users.
- **Solution:** README checklist; health endpoint; `check-db.js`; single deployment unit for URL + DB name.
- **Lesson:** Treat base URL and database name as one release artifact.
- **Future:** Flavor-specific build configs or remote config service.

### 20.2 Notification failure after successful booking

- **Root cause:** Awaited notify in same try as create; throw produced HTTP 500.
- **Impact:** Owner retries; duplicate-slot 409; booking exists in DB without success UI.
- **Solution:** Post-create try/catch; always 201 after persist.
- **Lesson:** Persist first, side effects second; consider outbox queue.
- **Future:** Message queue for notifications.

### 20.3 Zone fallback mis-assignment

- **Root cause:** Returning first zone when address did not match any district/polygon.
- **Impact:** Vets assigned outside true service area.
- **Solution:** Return null; admin manual assign; message to owner.
- **Lesson:** Geographic fail-open is dangerous — fail closed to unassigned.
- **Future:** Polygon-only matching with admin GIS tools.

### 20.4 Socket vs REST state mismatch

- **Root cause:** Mobile OS kills socket; missed `status_change`.
- **Impact:** Stale status until manual refresh.
- **Solution:** Pull on resume; socket listeners + refresh buttons.
- **Lesson:** Real-time enhances UX; REST is truth.
- **Future:** Entity version field for cheap polling.

### 20.5 Khalti verification race

- **Root cause:** WebView success before backend lookup completes.
- **Impact:** User thinks payment failed while order is paid.
- **Solution:** Client retry helper; backend idempotent completed handling.
- **Lesson:** Never trust WebView alone.
- **Future:** Webhook-primary verification path.

### 20.6 Status and role vocabulary drift

- **Root cause:** Legacy `CUSTOMER`, `VET`, multiple clients.
- **Impact:** Wrong admin filters; partner panels empty.
- **Solution:** `serviceRequestStatus.js`, `normalizeRole`.
- **Lesson:** Centralize enums early; codegen to clients.
- **Future:** OpenAPI-driven types.

### 20.7 Dual subscription models

- **Root cause:** `Subscription` (provider) vs `PetOwnerSubscription` (owner) naming collision.
- **Impact:** Developer wiring wrong routes.
- **Solution:** Separate paths `/subscriptions` vs `/pet-subscriptions`; documentation.
- **Lesson:** Namespace domain terms in API paths.
- **Future:** Rename provider model to `ProviderSubscription`.

### 20.8 Single partner binary, many roles

- **Root cause:** One vet app APK for vet, rider, seller, care.
- **Impact:** Large `PartnerHomeScreen` branching; QA matrix growth.
- **Solution:** Server authorization per endpoint; role-based home screens.
- **Lesson:** UI hiding is not security.
- **Future:** Feature modules per role with flags.

### 20.9 ngrok and CORS for mobile dev

- **Root cause:** Socket polling through ngrok requires `ngrok-skip-browser-warning` in allowed headers.
- **Impact:** Socket appeared “invalid token” or failed silently when interstitial blocked.
- **Solution:** Explicit allowed headers in Socket.io and Express CORS config in `server.js`.
- **Lesson:** Tunnel dev is first-class; test sockets on device, not only REST.
- **Future:** Staging environment with stable hostname.

---

## 21. Future Technical Roadmap

### 21.1 Near-term (0–6 months)

- Khalti server verification on `POST /pet-subscriptions/subscribe`
- Redis + Socket.io adapter for horizontal socket scale
- Refresh tokens and revocation on deactivate
- OpenAPI specification and client codegen
- Structured API error codes
- Outbox queue for FCM and email
- Optimistic concurrency on `ServiceRequest` (`__v` or status log collection)

### 21.2 Medium-term (6–18 months)

- Distance-aware vet assignment using live locations
- Analytics warehouse (BigQuery) fed from MongoDB
- Shop recommendation engine (events already exist: `ShopRecommendationEvent`)
- Read replica for admin reporting
- Kubernetes deployment with health/readiness probes
- Dedicated worker process for reminders and subscription renewals

### 21.3 Long-term (18+ months)

- Event-driven architecture (NATS/Kafka) for decoupled notify/payments
- GraphQL BFF for mobile over-fetch reduction
- Multi-region deployment with zone sharding
- ML-assisted diagnostics (with vet-in-the-loop product guardrails)
- Continuous GPS streaming for ETA
- eSewa and additional gateways via `payment_config` abstraction

---

## 22. Technical Conclusion

PawSewa’s current engineering is a **modular monolith** that correctly prioritizes **operational coherence** over premature distribution. The system unifies pet health continuity (PawID, medical history projection), commerce, dispatch, communications, and payments under one MongoDB truth layer and one JWT identity model, exposed through versioned REST, colocated Socket.io, and FCM for timeliness.

**Mature patterns already present:**

- Side-effect isolation after service request creation  
- Zone assignment without unsafe geographic fallback  
- Soft user deactivation with audit trail  
- Centralized payment configuration and Khalti verification for orders  
- Immutable audit log for admin actions  
- Expanded admin surface (zones, catalogue, reports, audit)  
- Performance test harness and QA documentation (`testcase.md`)  
- Server bound on `0.0.0.0` for real-device development  
- Background jobs for vaccination reminders and subscription renewal nudges  

**Pressure points before national-scale load:**

- Socket.io horizontal scaling  
- Subscription payment verification  
- JWT revocation and structured errors  
- In-process background jobs vs worker queue  

For a **final-year project**, the architecture demonstrates full-stack systems thinking: multi-sided marketplace logic, real-time coordination, payment integration, and explicit tradeoffs of startup engineering. For **production**, the path is clear: harden payments and auth, add observability, scale sockets and workers, while preserving the single-domain model that keeps the product maintainable across four client surfaces.

---

## Appendix A — Reference documents

| Document | Role |
|----------|------|
| [CLAUDE.md](CLAUDE.md) | Implementation map, routes, pitfalls |
| [README.md](README.md) | Runbook, env, tunnel, Khalti, performance tests |
| [DATA_GUIDE.md](DATA_GUIDE.md) | MongoDB, RBAC, migration |
| [docs/sys.md](docs/sys.md) | FCM, socket deployment |
| [docs/user-manual.md](docs/user-manual.md) | End-user flows |
| [testcase.md](testcase.md) | QA coverage report |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Business narrative |
| [prompt.md](prompt.md) | User-app workflows and UI design prompt |

## Appendix B — Critical implementation index

```
backend/src/server.js
backend/src/middleware/authMiddleware.js
backend/src/middleware/errorMiddleware.js
backend/src/config/payment_config.js
backend/src/constants/serviceRequestStatus.js
backend/src/controllers/serviceRequestController.js
backend/src/controllers/paymentController.js
backend/src/controllers/userController.js
backend/src/controllers/petOwnerSubscriptionController.js
backend/src/utils/notificationService.js
backend/src/utils/zoneMatcher.js
backend/src/utils/auditLogger.js
backend/src/jobs/subscriptionReminder.js
backend/src/sockets/socketAuth.js
apps/mobile/user_app/lib/core/api_client.dart
apps/mobile/user_app/lib/services/push_notification_service.dart
apps/mobile/vet_app/lib/screens/partner_home_screen.dart
apps/web/admin/lib/api.ts
apps/web/admin/app/(main)/dashboard/page.tsx
apps/web/admin/app/(main)/reports/page.tsx
apps/web/admin/app/(main)/zones/page.tsx
apps/web/admin/app/(main)/services/page.tsx
apps/web/admin/app/(main)/audit-log/page.tsx
```

---

*End of TECH.md — PawSewa Engineering Architecture Deep Dive (v2.0, no diagrams — point-form specification)*
