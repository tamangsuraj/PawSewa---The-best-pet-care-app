# PawSewa-Ecosystem Monorepo

A comprehensive pet care platform with mobile apps for users and veterinarians, web applications for customers and administrators, and a unified backend API.

## Project Structure

```
PawSewa-Ecosystem/
├── apps/
│   ├── mobile/
│   │   ├── user_app/          # Flutter app for pet owners
│   │   └── vet_app/           # Flutter app for veterinarians
│   └── web/
│       ├── website/           # Next.js customer-facing website (Port 3001)
│       └── admin/             # Next.js admin dashboard (Port 3002)
├── backend/                   # Node.js/Express API (Port 3000)
└── shared/
    ├── types/                 # TypeScript interfaces
    └── models_dart/           # Dart classes
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Flutter SDK (v3.10 or higher)
- npm or yarn

### Starting the Services

Open 5 separate terminal windows and run the following commands:

#### 1. Backend API (Port 3000)
```bash
cd backend
npm run dev
```

#### 2. Customer Website (Port 3001)
```bash
cd apps/web/website
npm run dev
```

#### 3. Admin Dashboard (Port 3002)
```bash
cd apps/web/admin
npm run dev
```

#### 4. User Mobile App
```bash
cd apps/mobile/user_app
flutter run
```

#### 5. Vet Mobile App
```bash
cd apps/mobile/vet_app
flutter run
```

## Technology Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Web Apps**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Mobile Apps**: Flutter, Dart
- **State Management**: Provider (Flutter)
- **HTTP Client**: Dio (Flutter)
- **Security**: JWT, bcryptjs, helmet, flutter_secure_storage

## Brand Colors

- Primary: `#703418`

## Development

Each service runs independently on its designated port. The backend API serves as the central data layer for all applications.

## Khalti Payment & API Configuration

### Backend `.env`

Add to `backend/.env` (copy from `backend/.env.example`):

```
KHALTI_SECRET_KEY=your_secret_key_from_dashboard
KHALTI_BASE_URL=https://dev.khalti.com/api/v2/
BASE_URL=http://localhost:3000
```

- **BASE_URL**: Use your **ngrok/tunnel URL** (e.g. `https://xxx.ngrok-free.app`) when testing from physical devices or remote browsers. Khalti redirects users back to this URL after payment. Using `localhost` causes SocketException when the mobile app or web app runs on a different host.

### Flutter Apps (User App & Vet App)

- API base URL is configured in `lib/core/api_config.dart`.
- For physical devices: Set API host to your PC's LAN IP (e.g. `192.168.1.5`) or ngrok URL.
- Override at runtime: `flutter run --dart-define=API_HOST=192.168.1.5`
- Or use "Set server URL" in-app to point to ngrok/tunnel.

### Web Apps (Admin & User Web)

- Set `NEXT_PUBLIC_API_URL` to your backend URL (e.g. `http://localhost:3000/api/v1` or `https://xxx.ngrok-free.app/api/v1`) so all API calls use the correct baseUrl and avoid connectivity errors.
