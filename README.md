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
