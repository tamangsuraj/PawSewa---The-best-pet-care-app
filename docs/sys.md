# Appendix E: System Configuration

**Project:** PawSewa monorepo  
**Version:** 1.0 · May 2026

Summarized setup for Firebase (FCM), backend access control, messaging, and Flutter deployment.

> **Important:** PawSewa does **not** use Firestore or Firebase Authentication for data. All app data lives in **MongoDB Atlas** and is accessed through the **Express REST API** with **JWT middleware**. Firebase is used for **Cloud Messaging (push)** and shares OAuth client IDs with **Google Sign-In**.

---

## 1. Architecture overview

| Layer | Technology |
|-------|------------|
| Database | MongoDB Atlas (`pawsewa_core`) |
| API | Node.js + Express (`/api/v1`) |
| Auth | JWT (stored in Flutter Secure Storage) |
| Real-time | Socket.io |
| Push | Firebase Cloud Messaging (FCM) only |
| Payments | Khalti / eSewa |

**Access control:** `authMiddleware.protect` + `authorize(...roles)` on Express routes — **not** Firestore security rules.

---

## 2. Firebase project configuration

### Create / use one Firebase project
1. Go to [Firebase Console](https://console.firebase.google.com) → create or select **PawSewa** project.
2. Enable **Cloud Messaging** (included by default on Blaze or Spark for FCM).
3. Register **three Android apps** (if needed):
   - User app: `com.pawsewa.user_app`
   - Partner app: `com.pawsewa.vet_app`
4. Register **iOS apps** with matching bundle IDs from Xcode (`Runner` target).
5. Optionally add a **Web app** for Flutter web FCM (if deploying web targets).

### Download config files (per Flutter app)

| App | Android | iOS | Dart options |
|-----|---------|-----|--------------|
| User | `apps/mobile/user_app/android/app/google-services.json` | `ios/Runner/GoogleService-Info.plist` | `lib/firebase_options.dart` |
| Partner | `apps/mobile/vet_app/android/app/google-services.json` | `ios/Runner/GoogleService-Info.plist` | `lib/firebase_options.dart` |

Regenerate Dart config after adding apps:

```bash
cd apps/mobile/user_app
flutterfire configure

cd apps/mobile/vet_app
flutterfire configure
```

### Android SHA-1 (required for Google Sign-In)
1. Firebase Console → Project settings → Your apps → Android app → **Add fingerprint**.
2. Add **debug** and **release** SHA-1 from:
   ```bash
   cd android && ./gradlew signingReport
   ```
3. Download updated `google-services.json` if prompted.

### Google OAuth (Sign-In)
- Use the same Google Cloud / Firebase project.
- Create **Web**, **Android**, and **iOS** OAuth 2.0 client IDs in Google Cloud Console.
- Set `GOOGLE_CLIENT_ID` (and optional `GOOGLE_CLIENT_ID_ANDROID` / `GOOGLE_CLIENT_ID_IOS`) in `backend/.env`.

---

## 3. Firestore security rules

**Not applicable.** PawSewa has no `firestore.rules` and no Firestore collections.

Data access is enforced server-side:

- **Missing JWT** → `401 Not authorized, no token`
- **Expired JWT** → `403 Session expired. Please log in again.`
- **Wrong role** → `403` via `authorize('admin' | 'veterinarian' | ...)`
- **Resource ownership** → checked in controllers (e.g. pet owner must own the pet)

For documentation purposes, treat **Express JWT + role middleware** as the equivalent of “security rules.”

---

## 4. Cloud Messaging (FCM) setup

### Backend (server push)

1. Firebase Console → **Project settings → Service accounts → Generate new private key**.
2. Copy the JSON into `backend/.env` as a single line:
   ```env
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
   ```
3. Restart backend. Log should show: `Service Account loaded. Push notifications active.`
4. FCM send logic: `backend/src/utils/fcm.js` → `sendMulticastToUser(userId, { title, body, data })`.
5. Device tokens stored on `User.fcmTokens` (max 5 per user).

**Register token from mobile (after login):**
- User app: `POST /api/v1/users/me/fcm-token` or `PATCH /api/v1/users/me` with `{ "fcmToken": "..." }`
- Partner app: `PATCH /api/v1/users/me` with `{ "fcmToken": "..." }`

### Mobile (client receive)

**User app** (`apps/mobile/user_app`):
- Packages: `firebase_core`, `firebase_messaging`, `flutter_local_notifications`
- Init: `PushNotificationService.instance.initialize()` in `main.dart`
- Android channel: `pawsewa_reminders`
- Tap handler: deep-links via `NavigationService` (`/service-request-detail`, `/order-detail`, `/health-records`, etc.)

**Partner app** (`apps/mobile/vet_app`):
- Same Firebase packages
- Android channel: `pawsewa_system`
- Deep-links: `/vet-appointment-detail`, `/rider-delivery-detail`, `/care-booking-detail`

### Notification payload (data field)

Backend includes `data.type` and `data.id` for navigation, e.g.:

| type | Action |
|------|--------|
| `appointment_accepted` | Open service request |
| `service_request_update` | Open tracking |
| `order_update` | Open My Orders |
| `medical_record` | Open health records (`petId`) |
| `chat_message` | Open vet chat |

### Permissions
- **Android 13+:** `POST_NOTIFICATIONS` (requested at runtime).
- **iOS:** permission requested via `FirebaseMessaging.requestPermission()`.

---

## 5. Backend environment (summary)

Copy `backend/.env.example` → `backend/.env` and set:

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `DB_NAME` | `pawsewa_core` |
| `JWT_SECRET` | Signing key for API tokens |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | FCM server push |
| `EMAIL_USER` / `EMAIL_PASS` | OTP & transactional email |
| `KHALTI_SECRET_KEY` | Payments |
| `BASE_URL` | Public backend URL (ngrok or production) |
| `CLOUDINARY_*` | Image uploads |

**Health check:** `GET /health`  
**API base:** `{BASE_URL}/api/v1`

**Local phone testing:** run `npm run tunnel` in `backend/` (ngrok) and point all clients to the tunnel URL.

---

## 6. Flutter build & deployment

### Prerequisites
- Flutter SDK **3.10+**
- Android Studio / Xcode (for store builds)
- Backend running and reachable from target device

### Configure API URL (all mobile apps)
- Default host in `lib/config/app_config.dart` / `lib/core/api_config.dart`
- Override at runtime via app settings or SharedPreferences key `api_host_override`
- Use **LAN IP** (`192.168.x.x:3000`) or **ngrok HTTPS URL** for physical devices

### User app (`apps/mobile/user_app`)

```bash
cd apps/mobile/user_app
flutter pub get
flutter analyze
flutter run                    # debug on connected device
```

| Target | Build command | Notes |
|--------|---------------|-------|
| **Android APK** | `flutter build apk --release` | Output: `build/app/outputs/flutter-apk/app-release.apk` |
| **Android App Bundle** | `flutter build appbundle --release` | Upload to Google Play |
| **iOS** | `flutter build ios --release` | Open Xcode → Archive → App Store Connect |
| **Web** | `flutter build web --release` | Output: `build/web/` — host on static server |

**Package ID:** `com.pawsewa.user_app`

### Partner app (`apps/mobile/vet_app`)

```bash
cd apps/mobile/vet_app
flutter pub get
flutter build apk --release      # or appbundle / ios
```

**Package ID:** `com.pawsewa.vet_app`

### Release checklist (both apps)
1. Bump `version:` in `pubspec.yaml` (`1.0.0+1` → name + build number).
2. Use **release signing** keystore (Android) / distribution cert (iOS).
3. Confirm `google-services.json` / `GoogleService-Info.plist` match **production** Firebase apps.
4. Set production `BASE_URL` and rebuild with production API host.
5. Test FCM on a real device (simulators have limited push support).
6. Upload to **Google Play** / **App Store** with store listing assets.

### Web targets
- **User Flutter web:** `flutter build web` from `user_app` (limited vs native; FCM requires web app in Firebase).
- **Customer website:** `apps/web/website` — `npm run build` (Next.js).
- **Admin panel:** `apps/web/admin` — `npm run build` (Next.js, port 3002 in dev).

---

## 7. Quick deployment map

```
MongoDB Atlas (pawsewa_core)
        ↑
Express API :3000  ←── JWT + Socket.io + FCM (firebase-admin)
        ↑
   ┌────┴────┬────────────┬─────────────┐
   │         │            │             │
User App  Vet App    Admin Web    Customer Web
(Flutter) (Flutter)  (Next.js)    (Next.js)
   │         │
Firebase FCM (client SDK + google-services)
```

---

## 8. Troubleshooting (short)

| Issue | Fix |
|-------|-----|
| No push notifications | Check `FIREBASE_SERVICE_ACCOUNT_JSON`, device token registered after login |
| API unreachable on phone | Use ngrok or LAN IP, not `localhost` |
| Google Sign-In fails | Add SHA-1 to Firebase; match OAuth client IDs in `.env` |
| Build fails on Android | Run `flutter clean && flutter pub get`; verify `google-services.json` |
| 401 / 403 on API | Token expired — app clears session and returns to login |

---

*See also: `docs/architecture.md`, `docs/user-manual.md`, `backend/.env.example`, `backend/TUNNEL_SETUP.md`*
