# PawSewa Data Guide

Technical documentation for the PawSewa unified production environment. Intended for developers who need to understand the database structure, execute applications, and validate data integrity.

---

## Table of Contents

1. [Database Architecture](#1-database-architecture)
2. [Role-Based Access Control (RBAC)](#2-role-based-access-control-rbac)
3. [Development Environment Execution](#3-development-environment-execution)
4. [Post-Migration Validation](#4-post-migration-validation)
5. [Payment Verification](#5-payment-verification)
6. [Using Postman](#6-using-postman)
7. [Using MongoDB Compass](#7-using-mongodb-compass)
8. [Checking Data via Browser Console and DevTools](#8-checking-data-via-browser-console-and-devtools)
9. [Firebase Console (If Used)](#9-firebase-console-if-used)
10. [Other Tooling](#10-other-tooling)

---

## 1. Database Architecture

### Unified Production Database

PawSewa has transitioned from fragmented databases (pawsewa_chat, pawsewa_dev, petcare) to a single unified database: **pawsewa_production**.

### Core Collections

| Collection      | Description                                      |
|-----------------|--------------------------------------------------|
| users           | All account details, roles, and saved addresses  |
| pets            | Pet profiles, linked via ownerId (ref: users)    |
| services        | Hostels, Spas, Grooming centers; linked via providerId (ref: users) |
| appointments    | Vet visits, Grooming sessions, Hostel stays; type field distinguishes |
| orders          | E-commerce shop transactions                     |
| chat_messages   | Communication data, linked by conversationId     |

### Collection Relationships

- **users** → pets (ownerId), services (providerId), orders (userId), appointments (customerId, staffId)
- **pets** → appointments (petId)
- **services** → appointments (serviceId)
- **orders** → users (assignedRiderId for rider assignment)

### Connecting to pawsewa_production

Set the following in `backend/.env`:

```
DB_NAME=pawsewa_production
```

The application will connect to the unified database. MongoDB Compass connection URI typically includes the database name (e.g. `mongodb://localhost:27017/pawsewa_production`).

---

## 2. Role-Based Access Control (RBAC)

The `role` field in the `users` collection controls access across all applications:

| Role          | Description                                           |
|---------------|-------------------------------------------------------|
| CUSTOMER      | Pet owners; access User App and Website               |
| VET           | Veterinarians; access Vet App for cases and service requests |
| RIDER         | Delivery personnel; access Vet App for order deliveries |
| SERVICE_OWNER | Hostel, Grooming, Spa, Training owners; manage services |
| ADMIN         | Full access; Admin Panel for management               |

### Access Matrix

| Platform      | CUSTOMER | VET | RIDER | SERVICE_OWNER | ADMIN |
|---------------|----------|-----|-------|---------------|-------|
| User App      | Yes      | No  | No    | No            | No    |
| Vet App       | No       | Yes | Yes   | Yes           | No    |
| Website       | Yes      | No  | No    | No            | No    |
| Admin Panel   | No       | No  | No    | No            | Yes   |

---

## 3. Development Environment Execution

### Prerequisites

- Node.js (v18+)
- MongoDB (local or Atlas)
- Flutter SDK (for mobile apps)
- Postman (optional, for API testing)

### Backend

```bash
cd backend
npm install
npm run dev
```

Default port: 3000. Base API URL: `http://localhost:3000/api/v1`

### User Web (Next.js)

```bash
cd apps/web/website
npm install
npm run dev
```

Runs on port 3001. URL: `http://localhost:3001`

### Admin Panel (Next.js)

```bash
cd apps/web/admin
npm install
npm run dev
```

Runs on port 3002. URL: `http://localhost:3002`

### Mobile Apps (Flutter)

Two separate Flutter apps share the same backend:

**User App** (pet owners):

```bash
cd apps/mobile/user_app
flutter pub get
flutter run -d <device_id>
```

**Vet App** (veterinarians, riders, service owners):

```bash
cd apps/mobile/vet_app
flutter pub get
flutter run -d <device_id>
```

To list available devices:

```bash
flutter devices
```

Target a specific device by ID, for example:

```bash
flutter run -d chrome
flutter run -d windows
flutter run -d <android-emulator-id>
```

Entry points:
- `apps/mobile/user_app/lib/main.dart` — User App
- `apps/mobile/vet_app/lib/main.dart` — Vet App (Vet, Rider, Service Owner based on role)

---

## 4. Post-Migration Validation

Use this checklist in MongoDB Compass to verify data integrity after migration.

### 4.1 Collection Presence

- [ ] Database `pawsewa_production` exists
- [ ] Collections present: users, pets, services, appointments, orders, chat_messages

### 4.2 Users Collection

- [ ] Every document has a `role` field
- [ ] Role values are one of: CUSTOMER, VET, RIDER, SERVICE_OWNER, ADMIN
- [ ] Riders exist: `{ "role": "RIDER" }` (or legacy `"rider"` if not yet migrated)

### 4.3 Orders Collection

- [ ] Orders have `assignedRiderId` (ObjectId ref to users) when assigned
- [ ] Orders have `deliveryLocation` with `address` and coordinates
- [ ] `paymentStatus` is `"paid"` or `"unpaid"`
- [ ] Filter: `{ "assignedRiderId": { "$exists": true, "$ne": null } }` returns only assigned orders

### 4.4 Appointments Collection

- [ ] `customerId` and `petId` are valid ObjectIds (ref users, pets)
- [ ] `staffId` (vet) is set when assigned: `{ "staffId": { "$exists": true, "$ne": null } }`
- [ ] `type` is one of: vet_visit, vet_appointment, hostel_stay, grooming, spa, training

### 4.5 Timestamps

- [ ] All documents have `createdAt` and `updatedAt` fields

### Sample Compass Queries

**Find orders with rider assigned:**

```json
{ "assignedRiderId": { "$exists": true, "$ne": null } }
```

**Find appointments with vet assigned:**

```json
{ "staffId": { "$exists": true, "$ne": null }, "type": "vet_appointment" }
```

**Find paid orders:**

```json
{ "paymentStatus": "paid" }
```

---

## 5. Payment Verification

### 5.1 Khalti Verification Endpoint

Server-side verification ensures payment status is validated against Khalti, not URL parameters.

**Endpoint:** `GET /api/v1/payments/verify?pidx=<pidx>`

**Example:**

```bash
curl "http://localhost:3000/api/v1/payments/verify?pidx=YOUR_PIDX"
```

### 5.2 Checking Payment Status in Database

**Orders** (`orders` collection):

- `paymentStatus`: `"paid"` or `"unpaid"`
- `paymentMethod`: `"khalti"` when paid via Khalti

MongoDB Compass filter:

```json
{ "paymentStatus": "paid" }
```

**Payment Records** (`payments` collection):

- `status`: `"completed"` or `"pending"`
- `gatewayTransactionId`: Khalti pidx

### 5.3 How to Verify a Payment Was Processed

1. **Obtain pidx** from the Khalti initiate response or redirect URL after payment.
2. **Call verify endpoint:**

   ```
   GET http://localhost:3000/api/v1/payments/verify?pidx=<pidx>
   ```

3. **Check response:**
   - Success: `{ "success": true, "message": "Payment completed", "orderId": "..." }`
   - Failure: `{ "success": false, "message": "..." }`
4. **Confirm in MongoDB Compass:**
   - Open `orders` collection
   - Find document by `_id` (from `orderId` in response)
   - Confirm `paymentStatus` is `"paid"` and `paymentMethod` is `"khalti"`

### 5.4 Khalti Status Mapping

| Khalti Status   | Meaning                    | Action                    |
|-----------------|----------------------------|---------------------------|
| Completed       | Money deducted             | Mark order/payment paid   |
| Pending         | In progress                | Do not mark paid          |
| Initiated       | Started but not completed  | Do not mark paid          |
| Expired         | Link timed out             | Ask user to retry         |
| User canceled   | User closed widget         | Mark failed/canceled      |

---

## 6. Using Postman

Postman is used to call the PawSewa API directly (GET, POST, PATCH, DELETE) without using the frontend.

### 6.1 Download and Install

1. Download from [https://www.postman.com/downloads/](https://www.postman.com/downloads/).
2. Install and open Postman.

### 6.2 Create an Environment

1. Click **Environments** in the left sidebar (or the gear icon).
2. Click **+** to create a new environment.
3. Name it (e.g. **PawSewa Local**).
4. Add a variable:
   - **Variable:** `baseUrl`
   - **Initial Value:** `http://localhost:3000/api/v1`
   - **Current Value:** same as above.
5. Save. For remote or ngrok backend, create another environment (e.g. **PawSewa Ngrok**) with `baseUrl` set to your tunnel URL plus `/api/v1`.
6. Select the environment from the dropdown in the top-right so requests use it.

### 6.3 Create a Collection

1. Click **Collections** in the left sidebar.
2. Click **+** or **Create Collection**.
3. Name it **PawSewa API**.

### 6.4 Create and Send a Request

1. Inside the collection, click **Add request**.
2. Name the request (e.g. "Get products").
3. Set **Method** (e.g. GET, POST, PATCH).
4. Set **URL** to `{{baseUrl}}/products` (or the path you need). Postman replaces `{{baseUrl}}` with the value from the selected environment.
5. Click **Send**. The response appears in the body section below.

### 6.5 Add Authorization for Protected Endpoints

Most endpoints require a JWT. Do the following:

1. Open the request.
2. Go to the **Authorization** tab.
3. **Type:** Bearer Token.
4. **Token:** paste your JWT. To get a token:
   - Create a **POST** request to `{{baseUrl}}/users/login` with Body (raw, JSON): `{"email":"your@email.com","password":"yourpassword"}`.
   - Send the request and copy the `token` (or `data.token`) from the response.
   - Paste it into the Bearer Token field. Alternatively, in the **Authorization** tab you can set Type to "Bearer Token" and paste the token there.

Alternatively, set a collection or environment variable `token` and in Authorization use `{{token}}` so you update it in one place.

### 6.6 Sending a JSON Body (POST or PATCH)

1. Select the **Body** tab.
2. Choose **raw**.
3. Select **JSON** from the dropdown on the right.
4. Enter the JSON, for example:

```json
{
  "name": "Buddy",
  "species": "Dog",
  "breed": "Labrador"
}
```

5. Click **Send**.

### 6.7 Example Requests

| Purpose           | Method | URL                          | Auth   |
|-------------------|--------|------------------------------|--------|
| List products     | GET    | `{{baseUrl}}/products`        | No     |
| Login             | POST   | `{{baseUrl}}/users/login`     | No     |
| My orders         | GET    | `{{baseUrl}}/orders/my`       | Bearer |
| Verify payment    | GET    | `{{baseUrl}}/payments/verify?pidx=XXX` | No |
| Admin: all orders | GET    | `{{baseUrl}}/orders`          | Bearer (admin) |

---

## 7. Using MongoDB Compass

MongoDB Compass is a GUI to view and edit MongoDB data. Use it to inspect and validate data in `pawsewa_production`.

### 7.1 Download and Install

1. Download from [https://www.mongodb.com/products/compass](https://www.mongodb.com/products/compass).
2. Install and open Compass.

### 7.2 Connect to the Database

1. On the **New Connection** screen, enter the connection string.
2. For local MongoDB:

   ```
   mongodb://localhost:27017
   ```

3. To open the unified database directly:

   ```
   mongodb://localhost:27017/pawsewa_production
   ```

4. Click **Connect**. If MongoDB is not running, start it (or start the backend with `npm run dev` if it starts MongoDB). Adjust the host/port if your MongoDB runs elsewhere (e.g. Atlas).

### 7.3 Find the Database and Collections

1. In the left sidebar you see a list of databases.
2. Click **pawsewa_production** (or the database name you use).
3. You see collections: `users`, `pets`, `services`, `appointments`, `orders`, `chat_messages`, and possibly `products`, `payments`, etc.
4. Click a collection name to open its documents in the main area.

### 7.4 Browse and Filter Documents

1. With a collection open, documents are shown in a table/list view.
2. Use the **Filter** bar at the top. Enter a MongoDB query in JSON, for example:

   - Find a user by email:
     ```json
     { "email": "admin@example.com" }
     ```
   - Find all riders:
     ```json
     { "role": "RIDER" }
     ```
   - Find paid orders:
     ```json
     { "paymentStatus": "paid" }
     ```
   - Find orders with a rider assigned:
     ```json
     { "assignedRiderId": { "$exists": true, "$ne": null } }
     ```

3. Click **Find** (or Apply) to run the filter.

### 7.5 View a Single Document

1. Click a row in the results to expand it, or double-click to open the document in a detailed view.
2. You can switch between Table and JSON view to see the full document structure and ObjectIds.

### 7.6 Edit a Document (Testing Only)

1. Double-click a document or click the **pencil** (Edit) icon.
2. Modify the JSON (e.g. change `role`, `paymentStatus`, or a name).
3. Click **Update** to save. Use this only for test data; avoid changing production data without a proper process.

### 7.7 Export Data

1. With a collection or filter result open, use the **Export** option (if available in your Compass version) to export documents as JSON or CSV for backup or analysis.

---

## 8. Checking Data via Browser Console and DevTools

You can verify API calls and responses from the Website and Admin Panel using the browser’s Developer Tools.

### 8.1 Open Developer Tools

1. Open the app in Chrome or Edge (e.g. Website at `http://localhost:3001` or Admin at `http://localhost:3002`).
2. Right-click anywhere on the page and select **Inspect**, or press **F12** (Windows/Linux) or **Cmd+Option+I** (Mac).
3. DevTools opens (usually at the bottom or side).

### 8.2 Network Tab: Inspect API Requests and Responses

1. Click the **Network** tab in DevTools.
2. Refresh the page (**F5** or **Ctrl+R**) so requests load.
3. In the filter bar, click **Fetch/XHR** so only API (fetch/XHR) requests are shown. This hides images, CSS, and script files.
4. Click any request in the list. You will see:
   - **Headers:** Request URL, Method (GET, POST, etc.), and request headers. Check **Request Headers** for `Authorization: Bearer ...` on protected calls.
   - **Payload** (or **Request**): The body sent for POST/PATCH (e.g. order payload, login credentials).
   - **Response** (or **Preview**): The JSON returned by the server (e.g. list of orders, user object, success flag).
5. To confirm payment or order flow: trigger the action in the app (e.g. place order, verify payment), then find the corresponding request (e.g. `orders`, `payments/verify`) and inspect the Response tab to see success/error and returned data.

### 8.3 Console Tab: Run Ad-Hoc Checks

1. Click the **Console** tab in DevTools.
2. You can type JavaScript that runs in the page context. For example, to see what the app stored:
   - **Local storage:** Type `localStorage` and press Enter to expand and inspect keys (e.g. `admin-token`, `token`). To see a specific item: `localStorage.getItem('admin-token')`.
   - **Session storage:** `sessionStorage` or `sessionStorage.getItem('key')`.
3. To test the API from the console (same origin as the page), you can use `fetch`:

```javascript
fetch('http://localhost:3000/api/v1/products')
  .then(r => r.json())
  .then(data => console.log(data));
```

Replace the URL with the endpoint you need. For protected endpoints, add the token:

```javascript
fetch('http://localhost:3000/api/v1/orders/my', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin-token') }
})
  .then(r => r.json())
  .then(data => console.log(data));
```

4. Check the console for errors (red messages) if a feature is not working; they often indicate failed API calls or missing auth.

### 8.4 Application Tab: Inspect Stored Tokens

1. In DevTools, open the **Application** tab (Chrome) or **Storage** (Firefox).
2. Under **Storage**, expand **Local Storage** and click your site’s origin (e.g. `http://localhost:3002`).
3. You see key-value pairs (e.g. `admin-token`, `admin-user`). You can confirm that a token is present after login. Do not share or paste these values; use them only for debugging.

---

## 9. Firebase Console (If Used)

PawSewa may use Firebase for Google Sign-In and optionally for file storage. Most business data lives in MongoDB; Firebase is used for auth and assets as configured.

### 9.1 Log In to Firebase Console

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/).
2. Sign in with the Google account that owns the PawSewa project.
3. Select the **PawSewa** project from the project list.

### 9.2 Authentication

1. In the left sidebar, click **Build** then **Authentication**.
2. Open the **Users** tab. You see users who signed in with Google (and any other enabled providers).
3. Use this to:
   - Confirm that a test user appears after Google Sign-In.
   - Debug sign-in issues (e.g. user not created, wrong project).
4. Under **Sign-in method**, ensure **Google** (and any other providers you use) is enabled and the correct project credentials are used in the app.

### 9.3 Storage (If Enabled)

1. Click **Build** then **Storage**.
2. You see files uploaded via Firebase Storage (e.g. profile images, product images if the app uses Firebase for uploads).
3. Use this to verify uploads and to clean up test files if needed.

### 9.4 Firestore / Realtime Database

If the project does not use Firestore or Realtime Database, these sections will be empty or unused. Primary data is in MongoDB; Firebase is used only where explicitly integrated (e.g. Auth, Storage).

### 9.5 When to Use Firebase Console

- Verify Google Sign-In users and troubleshoot OAuth.
- Inspect or manage stored files (Storage).
- Check project settings (API keys, authorized domains) if the app reports Firebase-related errors.

---

## 10. Other Tooling

### 10.1 Google Maps Integration (Rider App)

The Vet App (Rider flow) uses **url_launcher** to open external map apps.

**Deep link:** `google.navigation:q=lat,lng`

**Behavior:** On Android this opens Google Maps turn-by-turn; on iOS it may open Apple Maps or Google Maps. Fallback is a browser map URL.

**Dependencies:** `url_launcher`, `flutter_map`, `latlong2` in the Flutter app.

### 10.2 Base URLs Summary

| App / Service   | URL or Command                    |
|-----------------|-----------------------------------|
| Backend API     | `http://localhost:3000/api/v1`   |
| Website         | `http://localhost:3001`          |
| Admin Panel     | `http://localhost:3002`          |
| MongoDB (local) | `mongodb://localhost:27017`      |
| pawsewa_production | `mongodb://localhost:27017/pawsewa_production` |

---

## Quick Reference

| Component      | Command / URL                               |
|----------------|---------------------------------------------|
| Backend        | `cd backend && npm run dev`                 |
| User Web       | `cd apps/web/website && npm run dev`        |
| Admin Panel    | `cd apps/web/admin && npm run dev`          |
| User App       | `cd apps/mobile/user_app && flutter run -d <device>` |
| Vet/Rider App  | `cd apps/mobile/vet_app && flutter run -d <device>` |
| API Base       | `http://localhost:3000/api/v1`              |
| Payment Verify | `GET /api/v1/payments/verify?pidx=<pidx>`   |

---

*Last updated for PawSewa unified production environment. Adjust ports and URLs for your setup.*
