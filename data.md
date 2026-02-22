# PawSewa Data Guide — Project Handover

A beginner-friendly guide for junior developers to set up tools, inspect live data, and understand how data flows through the **User App**, **Vet App**, **Website**, and **Admin Panel**.

---

## 1. The Browser "Inspector" (Seeing Live Data)

Use the browser DevTools to inspect API calls in real time on the **Website** (Next.js) and **Admin Panel**.

### Step 1: Open DevTools
1. Open the app in Chrome or Edge.
2. **Right-click** anywhere on the page → **Inspect** (or press `F12`).
3. DevTools opens at the bottom or side.

### Step 2: Open the Network Tab
1. Click the **Network** tab.
2. Refresh the page (`F5` or `Ctrl+R`) so requests appear as they load.

### Step 3: Filter API Calls
1. In the filter bar, click **Fetch/XHR** so only API requests are shown.
2. This hides images, CSS, JS, and shows mainly backend API calls.

### Step 4: Inspect a Request
1. Click any request in the list.
2. Use the **Payload** tab to see the **body** sent to the server.
3. Use the **Response** tab to see the **JSON** returned by the server.
4. Use the **Headers** tab to see the request URL, method (`GET`, `POST`, etc.), and `Authorization` header if used.

**Example:** On the Website shop checkout, look for `POST` requests to `/api/v1/orders` to see the order payload and response.

---

## 2. MongoDB Compass Setup & Usage

MongoDB Compass is a GUI to view and edit the database. PawSewa uses **MongoDB** for Users, Pets, Cases, Orders, etc.

### Step 1: Download & Install
1. Download MongoDB Compass: [https://www.mongodb.com/products/compass](https://www.mongodb.com/products/compass)
2. Install and open it.

### Step 2: Connect to the Database
1. In the **New Connection** screen, paste this URI:
   ```
   mongodb://localhost:27017
   ```
2. Click **Connect**.
3. If MongoDB is running (via `npm run dev` in the backend), the connection will succeed.

### Step 3: Find the PawSewa Database
1. In the left sidebar, find the database (often named `pawsewa` or similar).
2. Expand it to see collections such as:
   - `users` — Pet owners, vets, admins
   - `pets` — Pet records
   - `cases` — Assistance requests
   - `orders` — Shop orders
   - `products` — Shop products

### Step 4: Browse & Filter Data
1. Click a collection (e.g. `users`).
2. You’ll see documents in a table.
3. Use the **Filter** bar at the top to query, e.g.:
   ```
   { "name": "John" }
   ```
   or
   ```
   { "email": { "$regex": "admin", "$options": "i" } }
   ```
4. Press **Apply** to run the filter.

### Step 5: Edit Data (Testing)
1. Double-click a document or click the **pencil** icon next to it.
2. Edit fields in the JSON view.
3. Click **Update** to save.
4. Use this for test data (e.g. changing a user’s role or a pet’s name).

---

## 3. Postman API Testing

Postman lets you call the PawSewa API directly (GET, POST, PATCH, DELETE).

### Step 1: Download Postman
1. Download: [https://www.postman.com/downloads/](https://www.postman.com/downloads/)
2. Install and open Postman.

### Step 2: Create a Collection
1. Click **Collections** in the left sidebar.
2. Click **+** or **Create Collection**.
3. Name it **PawSewa API**.

### Step 3: Create a Request
1. Inside the collection, click **Add request**.
2. Set:
   - **Method:** e.g. `GET`, `POST`, `PATCH`
   - **URL:** e.g. `http://localhost:3000/api/v1/pets` (replace port if different)
3. Click **Send** to run the request.

### Step 4: Add Authorization (Protected Endpoints)
1. Open the **Headers** tab.
2. Add a header:
   - **Key:** `Authorization`
   - **Value:** `Bearer YOUR_JWT_TOKEN`
3. Get the token from:
   - Browser DevTools → Network → select a logged-in request → Headers → copy the `Authorization` value
   - Or from the login API response

### Step 5: Send JSON Body (POST/PATCH)
1. Open the **Body** tab.
2. Select **raw**.
3. Choose **JSON** from the dropdown.
4. Enter JSON, for example:
   ```json
   {
     "name": "Buddy",
     "species": "Dog",
     "breed": "Labrador"
   }
   ```
5. Click **Send**.

**Example Endpoints:**
- `GET http://localhost:3000/api/v1/products` — List products
- `GET http://localhost:3000/api/v1/cases` — List cases (Admin token required)
- `POST http://localhost:3000/api/v1/orders` — Create order (User token + body)

---

## 4. Firebase Console (If Used)

PawSewa uses Firebase mainly for **Google Sign-in** and optionally **Firebase Storage**. Auth and most data live in the backend + MongoDB, not Firestore/Realtime DB.

### Step 1: Log In
1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Sign in with the project’s Google account.
3. Select the **PawSewa** project.

### Step 2: What You Can See
- **Authentication** → Users tab: Google sign-in users.
- **Storage** → Files (if used for images).
- **Firestore Database** / **Realtime Database**: Only if the project adds them later. Currently, most data is in MongoDB.

### When to Use Firebase
- Check Google Sign-in users.
- Debug OAuth issues.
- Inspect uploaded files in Storage (if enabled).

---

## 5. Vibe Coding Context

This project was built using **AI-assisted “vibe coding”**. Patterns and data handling may not always be obvious from the code alone.

### Tips for Understanding the Codebase

1. **Use Cursor AI**
   - `@Codebase` — Ask about how a feature works across the project.
   - `Ctrl+L` (or `Cmd+L`) — Open the AI chat to ask about a selected file or snippet.

2. **Ask Concrete Questions**
   - “Where is the vet assignment logic?”
   - “How does the cart send data to the checkout API?”
   - “Where is `petName` populated for cases?”

3. **Read API Routes First**
   - Backend routes live in `backend/src/routes/` (e.g. `caseRoutes.js`, `orderRoutes.js`).
   - Controllers in `backend/src/controllers/` contain the main logic.

4. **Trace Data Flow**
   - Website: `apps/web/website/` → API calls in `lib/api.ts` or `context/`.
   - User App: `apps/mobile/user_app/lib/` → `api_client.dart`.
   - Vet App: `apps/mobile/vet_app/lib/` → `api_client.dart`.
   - Admin: `apps/web/admin/` → axios/fetch calls.

---

## Quick Reference: Base URLs

| App            | URL (typical)              |
|----------------|----------------------------|
| Backend API    | `http://localhost:3000/api/v1` |
| Website        | `http://localhost:3001`    |
| Admin Panel    | `http://localhost:3002` (or configured port) |
| MongoDB        | `mongodb://localhost:27017` |

---

*Last updated for PawSewa project handover. Adjust URLs and ports if your setup differs.*
