# PawSewa

PawSewa is a pet care platform: mobile apps for pet owners and veterinarians, web apps for customers and admins, and a single Node.js backend. Pet owners shop, book services and care, and pay online; vets get appointments and manage work in the partner app; admins manage users, requests, orders, cases, supplies, and payment logs.

## Repository structure

```
PawSewa/
├── apps/
│   ├── mobile/
│   │   ├── user_app/     # Flutter – pet owners (shop, services, care, payments, chat)
│   │   └── vet_app/      # Flutter – vets / staff (appointments, cases, location, earnings)
│   └── web/
│       ├── website/      # Next.js – customer site (port 3001)
│       └── admin/        # Next.js – admin dashboard (port 3002)
├── backend/              # Node.js / Express API (port 3000)
└── shared/
    ├── types/            # TypeScript interfaces (User, Pet, Appointment, Chat, etc.)
    └── models_dart/      # Dart models (appointment, pet, user)
```

## Tech stack

**Backend (Node.js)**  
Express 5, MongoDB (Mongoose), JWT + bcrypt, helmet, cors, express-mongo-sanitize, express-rate-limit. Socket.io for real-time chat and presence. Multer + Cloudinary for image uploads. Nodemailer for OTP emails. Google OAuth (google-auth-library). Axios for outbound calls (e.g. Khalti). Environment via dotenv.

**Customer website (Next.js)**  
Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS. Axios, React Hook Form + Zod + @hookform/resolvers. Google Sign-In (@react-oauth/google). Leaflet / react-leaflet for maps. Lucide React, clsx, tailwind-merge. QR (react-qr-code).

**Admin dashboard (Next.js)**  
Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS. Axios, React Hook Form + Zod + @hookform/resolvers. Socket.io-client for real-time updates. React Hot Toast, Lucide React, clsx, tailwind-merge.

**User app (Flutter)**  
Dart 3.10+, Flutter. HTTP: Dio. State: Provider, flutter_bloc, equatable. Auth/tokens: flutter_secure_storage, shared_preferences. Google Sign-In. Maps: flutter_map, latlong2. Images: image_picker, cached_network_image. Real-time: socket_io_client. In-app browser: webview_flutter (Khalti). Other: google_fonts, url_launcher, permission_handler, intl, qr_flutter, google_nav_bar, lucide_icons, confetti.

**Vet app (Flutter)**  
Dart 3.10+, Flutter. HTTP: Dio. State: flutter_bloc, equatable. Auth: flutter_secure_storage, shared_preferences. Maps & location: flutter_map, latlong2, geolocator, permission_handler. Images: image_picker. Other: google_fonts, url_launcher, http, qr_flutter, share_plus.

**Brand**  
Primary color: `#703418` (PawSewa brown). Used for payment buttons and main CTAs across web and mobile.

## Prerequisites

- Node.js 18+
- npm or yarn
- Flutter SDK 3.10+
- MongoDB (local or Atlas connection string)
- (Optional) ngrok account for tunnel testing

## Running the project

All apps talk to the backend. Run each in its own terminal.

**1. Backend (port 3000)**

```bash
cd backend
npm install
npm start

**1. Tunnel (port 3000)**

```bash
cd backend
npm install
npm run tunnel
```

**2. Customer website (port 3001)**

```bash
cd apps/web/website
npm install
npm run dev
```

**3. Admin dashboard (port 3002)**

```bash
cd apps/web/admin
npm run dev
```

**4. User app (Flutter)**

```bash
cd apps/mobile/user_app
flutter pub get
flutter run
```

**5. Vet app (Flutter)**

```bash
cd apps/mobile/vet_app
flutter pub get
flutter run
```

On the same machine, website and admin can use `http://localhost:3000` as API URL. For the mobile apps from a physical device, the device must reach the backend: use your PC’s LAN IP or a tunnel.

## Running with a tunnel (ngrok)

When the phone (or a browser on another network) cannot reach `localhost` or your LAN IP, expose the backend with ngrok so Khalti and the apps can call it.

1. Install ngrok and add your authtoken (see [backend/TUNNEL_SETUP.md](backend/TUNNEL_SETUP.md)).
2. Start the backend: `cd backend && npm run dev`.
3. In a second terminal: `cd backend && npm run tunnel`. This runs `ngrok http 3000` and prints a URL like `https://abc123.ngrok-free.app`.
4. Set `BASE_URL` in `backend/.env` to that URL (e.g. `BASE_URL=https://abc123.ngrok-free.app`). Khalti will redirect users back to this URL after payment.
5. **User app**: Either build with `flutter run --dart-define=API_HOST=abc123.ngrok-free.app` (no `https://` in API_HOST when using full-URL override), or open the app and use “Can’t connect? Set server URL” on the login screen and paste the ngrok URL (e.g. `https://abc123.ngrok-free.app`). The app stores it and uses it for API and Socket.io.
6. **Vet app**: Run with the same host, e.g. `flutter run --dart-define=API_HOST=abc123.ngrok-free.app`, or set the backend base in `apps/mobile/vet_app/lib/core/constants.dart` (default host is `192.168.1.5`).
7. **Website / Admin**: In `.env.local`, set `NEXT_PUBLIC_API_URL` to `https://abc123.ngrok-free.app/api/v1` so they hit the tunneled backend.

The free ngrok URL changes each time you restart the tunnel; update `BASE_URL`, the app server URL, and `NEXT_PUBLIC_API_URL` when that happens.

## Environment variables

**Backend (`backend/.env`)**  
Copy from `backend/.env.example`. Main entries: `PORT`, `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`; `EMAIL_USER`, `EMAIL_PASS` (OTP); `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; `GOOGLE_CLIENT_ID`; `KHALTI_SECRET_KEY`, `KHALTI_BASE_URL` (sandbox: `https://dev.khalti.com/api/v2/`), `BASE_URL` (public backend URL for Khalti redirects and callbacks; use ngrok URL when testing from other devices).

**Customer website (`apps/web/website/.env.local`)**  
`NEXT_PUBLIC_API_URL` (backend base, e.g. `http://localhost:3000/api/v1` or ngrok + `/api/v1`), `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

**Admin (`apps/web/admin/.env.local`)**  
`NEXT_PUBLIC_API_URL` (same idea as website).

**User app**  
API host comes from `lib/core/constants.dart` (default `192.168.1.5`) and optional override in `lib/core/api_config.dart` (e.g. “Set server URL” stores a host or full ngrok URL). Override at build: `flutter run --dart-define=API_HOST=192.168.1.5`.

**Vet app**  
API host in `lib/core/constants.dart` (`API_HOST` default `192.168.1.5`). Override at build: `flutter run --dart-define=API_HOST=192.168.1.5` or your ngrok host.

## Payments (Khalti)

Payments go through Khalti. Backend uses `KHALTI_SECRET_KEY` and `KHALTI_BASE_URL` from `.env`; `BASE_URL` is used for success/failure redirects and the callback URL.

Flow: User places order or initiates service/care payment; backend creates the record and calls Khalti initiate; backend returns `payment_url`. Web redirects to it; mobile opens it in an in-app WebView. After payment, Khalti redirects to the backend callback. Backend verifies with Khalti lookup; on “Completed”, it marks the order or payment as paid and appends a row to the PaymentLog collection. Pet owners must complete the service fee before a vet is assigned (and before the vet sees the new appointment).

**Admin**  
The “Payment Logs” page (sidebar) lists test transactions: pidx, amount, status, type (order/service/care). Filter by status and refresh as needed.

Payment buttons across the apps use the brand brown `#703418` with white text.

## Summary

- **Backend**: Single API and Socket.io server; auth, users, pets, orders, products, promos, service/care requests, payments (Khalti), cases, locations, notifications, chat.
- **Website**: Browse vets, shop, checkout with Khalti, dashboard, Google Sign-In.
- **Admin**: Users, vets, cases, service requests, supplies, shops, promos, transactions, payment logs, settings.
- **User app**: Register, pets, shop, cart, Khalti in WebView, services/care, tracking, chat, orders.
- **Vet app**: Appointments, cases, location, earnings; service fee must be paid by customer before assignment.

For detailed tunnel steps, see [backend/TUNNEL_SETUP.md](backend/TUNNEL_SETUP.md).
