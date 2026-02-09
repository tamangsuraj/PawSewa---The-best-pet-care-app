# Google OAuth Complete Setup Guide for PawSewa

This guide will help you set up Google OAuth authentication for the entire PawSewa platform (Backend, Website, and Mobile App).

## Table of Contents
1. [Google Cloud Console Setup](#google-cloud-console-setup)
2. [Backend Configuration](#backend-configuration)
3. [Website Configuration](#website-configuration)
4. [Mobile App Configuration](#mobile-app-configuration)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Google Cloud Console Setup

### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: "PawSewa"
4. Click "Create"

### Step 2: Enable Required APIs
1. Go to "APIs & Services" → "Library"
2. Search for and enable:
   - Google+ API
   - Google Identity Toolkit API

### Step 3: Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" (or "Internal" if using Google Workspace)
3. Fill in the required information:
   - App name: **PawSewa**
   - User support email: Your email
   - Developer contact: Your email
4. Click "Save and Continue"
5. Add scopes (optional for now)
6. Add test users if in testing mode
7. Click "Save and Continue"

### Step 4: Create OAuth 2.0 Credentials

#### A. Web Client (for Backend & Website)
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Name: "PawSewa Web Client"
5. Authorized JavaScript origins:
   ```
   http://localhost:3001
   http://localhost:3002
   ```
6. Authorized redirect URIs:
   ```
   http://localhost:3001
   http://localhost:3002
   ```
7. Click "Create"
8. **IMPORTANT**: Copy the Client ID (you'll need this!)

#### B. Android Client (for Mobile App)
1. First, get your SHA-1 fingerprint:
   ```bash
   cd apps/mobile/user_app/android
   ./gradlew signingReport
   ```
   Or on Windows:
   ```bash
   cd apps\mobile\user_app\android
   gradlew.bat signingReport
   ```
   Copy the SHA-1 from the "debug" variant.

2. Back in Google Cloud Console:
   - Click "Create Credentials" → "OAuth client ID"
   - Select "Android"
   - Name: "PawSewa Android"
   - Package name: `com.example.user_app`
   - Paste your SHA-1 fingerprint
   - Click "Create"

---

## Backend Configuration

### Update .env file
```bash
cd backend
```

Edit `.env` and add:
```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Replace `YOUR_WEB_CLIENT_ID` with the Web Client ID from Step 4A.

### Install Dependencies
```bash
npm install google-auth-library
```

### Restart Backend
```bash
npm run dev
```

---

## Website Configuration

### Update .env.local file
```bash
cd apps/web/website
```

Edit `.env.local` and add:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Use the **same** Web Client ID from the backend.

### Install Dependencies
```bash
npm install @react-oauth/google
```

### Restart Website
```bash
npm run dev
```

---

## Mobile App Configuration

### Update pubspec.yaml
Already done! The following packages are added:
- `google_sign_in: ^6.2.1`
- `permission_handler: ^11.3.0`

### Install Dependencies
```bash
cd apps/mobile/user_app
flutter pub get
```

### Android Configuration

#### 1. Update AndroidManifest.xml
Already configured with notification permission!

#### 2. No additional configuration needed
The Android OAuth client uses the SHA-1 fingerprint, so no client ID needs to be hardcoded.

### Run the App
```bash
flutter run
```

---

## Testing

### Test Backend API
```bash
curl -X POST http://localhost:3000/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"googleToken": "YOUR_GOOGLE_ID_TOKEN"}'
```

### Test Website
1. Open http://localhost:3001/login
2. Click "Continue with Google"
3. Select your Google account
4. You should be redirected to the dashboard

### Test Mobile App
1. Run `flutter run`
2. On the login screen, click "Continue with Google"
3. Select your Google account
4. Grant permissions
5. You should see the notification permission dialog
6. You should be logged in to the Pet Dashboard

---

## Features Implemented

### Backend
✅ POST `/api/v1/auth/google` endpoint
✅ Google token verification using `google-auth-library`
✅ Auto-account creation for new users
✅ JWT token generation
✅ Role enforcement (pet_owner only)

### Website
✅ Google Sign-In button on Login page
✅ Google Sign-In button on Register page
✅ OAuth flow using `@react-oauth/google`
✅ Role-based access control
✅ Automatic redirect after successful login

### Mobile App
✅ Google Sign-In button on Login screen
✅ Google Sign-In button on Register screen
✅ Native Google Account Picker
✅ Notification permission dialog after login
✅ Custom permission dialog with PawSewa branding (#703418)
✅ Permission handler service
✅ Role enforcement (pet_owner only)

---

## Troubleshooting

### "Invalid client" error
- **Backend**: Check that `GOOGLE_CLIENT_ID` in `.env` matches your Web Client ID
- **Website**: Check that `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local` matches your Web Client ID
- **Mobile**: Verify SHA-1 fingerprint matches in Google Cloud Console

### "Sign in failed" on Mobile
1. Check SHA-1 fingerprint:
   ```bash
   cd apps/mobile/user_app/android
   ./gradlew signingReport
   ```
2. Verify package name is `com.example.user_app`
3. Make sure Google+ API is enabled
4. Check that backend is running and accessible from your device

### "Connection refused" on Mobile
1. Make sure backend is running: `http://localhost:3000`
2. Update `apps/mobile/user_app/lib/core/constants.dart`:
   ```dart
   static const String baseUrl = 'http://YOUR_COMPUTER_IP:3000/api/v1';
   ```
3. Make sure your phone and computer are on the same WiFi
4. Check Windows Firewall allows port 3000

### Notification permission not showing
- Android 13+ required for `POST_NOTIFICATIONS` permission
- Check that `permission_handler` package is installed
- Verify AndroidManifest.xml has the permission declared

### Google Sign-In button not working on Website
1. Check browser console for errors
2. Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set correctly
3. Make sure the domain is added to "Authorized JavaScript origins"
4. Clear browser cache and cookies

---

## Security Notes

⚠️ **Important**: 
- Never commit `.env` or `.env.local` files to version control
- Use different OAuth clients for production
- Enable additional security features in Google Cloud Console for production
- Rotate credentials regularly
- Use HTTPS in production

---

## Support

For issues or questions:
1. Check the [Google Sign-In documentation](https://developers.google.com/identity)
2. Review the [Flutter google_sign_in package](https://pub.dev/packages/google_sign_in)
3. Check the [React OAuth Google documentation](https://www.npmjs.com/package/@react-oauth/google)

---

## Summary

You've successfully implemented:
- ✅ Google OAuth backend API
- ✅ Google Sign-In on website (Login & Register)
- ✅ Google Sign-In on mobile app (Login & Register)
- ✅ Notification permission handling
- ✅ Role-based access control
- ✅ Unified authentication flow

**Next Steps**:
1. Get your Google Client IDs from Google Cloud Console
2. Update the `.env` files with your actual Client IDs
3. Test the complete flow
4. Deploy to production with proper security measures
