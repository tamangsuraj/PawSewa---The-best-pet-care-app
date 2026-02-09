# PawSewa Partner

The PawSewa Partner mobile application for veterinarians, shop owners, care service providers, and delivery partners.

## About

PawSewa Partner is a Flutter-based mobile app that enables service partners to:
- Manage their professional profiles
- View and handle assigned cases
- Track case status and urgency
- Communicate with the dispatch team
- Provide quality pet care services

## Partner Roles

This app supports multiple partner types:
- **Veterinarians**: Handle medical cases and emergencies
- **Shop Owners**: Manage pet supply orders
- **Care Service Providers**: Provide grooming and care services
- **Delivery Partners**: Handle delivery logistics

## Getting Started

### Prerequisites
- Flutter SDK (latest stable version)
- Android Studio / Xcode for mobile development
- Backend API running (see backend README)

### Installation

1. Install dependencies:
```bash
flutter pub get
```

2. Configure API endpoint in `lib/core/constants.dart`

3. Run the app:
```bash
flutter run
```

## Features

- **Secure Authentication**: Role-based login for partners
- **Profile Management**: Update professional details and bio
- **Case Management**: View assigned cases with urgency indicators
- **Real-time Updates**: Live case status tracking
- **Statistics Dashboard**: Track performance metrics

## Project Structure

```
lib/
├── core/           # Core utilities (API client, storage, constants)
├── models/         # Data models
├── screens/        # UI screens
└── services/       # Business logic services
```

## Resources

- [Flutter Documentation](https://docs.flutter.dev/)
- [PawSewa Backend API](../../backend/README.md)
- [Flutter Cookbook](https://docs.flutter.dev/cookbook)
