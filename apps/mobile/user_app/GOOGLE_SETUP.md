# Google Sign-In Setup Guide

## Prerequisites
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google+ API
3. Create OAuth 2.0 credentials

## Android Setup

### 1. Get SHA-1 Certificate Fingerprint

Run this command in your project directory:
```bash
cd android
./gradlew signingReport
```

Or for Windows:
```bash
cd android
gradlew.bat signingReport
```

Copy the SHA-1 fingerprint from the output.

### 2. Configure OAuth Consent Screen
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" > "OAuth consent screen"
3. Fill in the required information
4. Add test users if needed

### 3. Create Android OAuth Client ID
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Android"
4. Enter package name: `com.example.user_app`
5. Paste your SHA-1 fingerprint
6. Click "Create"

### 4. Create Web OAuth Client ID (for backend)
1. Click "Create Credentials" > "OAuth client ID"
2. Select "Web application"
3. Add authorized redirect URIs if needed
4. Click "Create"
5. Copy the Client ID

### 5. Update Configuration Files

#### Backend (.env)
```env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

#### Website (.env.local)
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

#### Mobile App (pubspec.yaml)
Already configured! Just run:
```bash
flutter pub get
```

## iOS Setup (Optional)

### 1. Create iOS OAuth Client ID
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "iOS"
4. Enter bundle ID: `com.example.userApp`
5. Click "Create"

### 2. Update Info.plist
Add the following to `ios/Runner/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.YOUR-CLIENT-ID</string>
        </array>
    </dict>
</array>
```

## Testing

### Test Google Sign-In
1. Make sure backend is running on port 3000
2. Run the mobile app: `flutter run`
3. Click "Continue with Google"
4. Select your Google account
5. Grant permissions
6. You should be logged in!

### Test Notification Permission
After successful login, you should see a dialog asking for notification permission.

## Troubleshooting

### "Sign in failed" error
- Check that SHA-1 fingerprint matches
- Verify package name is correct
- Make sure Google+ API is enabled
- Check backend is running and accessible

### "Invalid client" error
- Verify GOOGLE_CLIENT_ID in backend .env
- Make sure you're using the Web client ID in backend
- Check that the token is being sent correctly

### Permission dialog not showing
- Check Android version (Android 13+ required for POST_NOTIFICATIONS)
- Verify permission_handler package is installed
- Check AndroidManifest.xml has the permission declared
