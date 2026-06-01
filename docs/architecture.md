# Pawsome Architecture Overview

## Backend
- Runtime: Node.js + Express
- Database: MongoDB (Mongoose ODM)
- Authentication: JWT (jsonwebtoken) — stored in device SecureStorage
- Push Notifications: Firebase Cloud Messaging (FCM) — send only
- Payments: Khalti (primary), eSewa (secondary)
- Real-time: Socket.io

## Apps
| App | Platform | Framework |
|-----|----------|-----------|
| User App | Android + iOS | Flutter |
| Vet/Partner App | Android + iOS | Flutter |
| Admin Panel | Web (Next.js) | React/TypeScript |
| User Website | Web | Flutter Web |

## Access Control
All API routes protected by `authMiddleware.protect` (JWT verify).
Role restriction via `authorize(...roles)` middleware.
No Firestore security rules — MongoDB documents are accessed only
through Express controllers that enforce ownership and role checks.

## Monorepo Structure
```
apps/
  mobile/user_app/     # Pet owner Flutter app
  mobile/vet_app/      # Vet/rider/shop/care Flutter app
  web/admin/           # Admin panel (Next.js)
  web/user_website/    # User website (Flutter Web)
backend/               # Node.js Express API
docs/                  # Documentation
```
