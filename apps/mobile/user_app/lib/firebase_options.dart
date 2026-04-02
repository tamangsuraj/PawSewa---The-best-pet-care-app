// Generated from google-services.json / GoogleService-Info.plist for PawSewa (pawsewa-25997).
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('Firebase has not been configured for web in this app.');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError('Firebase has not been configured for this platform.');
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAXXtiBkFoUoBHBhGzT3ZXmHpJXK-qLzk8',
    appId: '1:188502859936:android:6d4d072833a605f61ce9c5',
    messagingSenderId: '188502859936',
    projectId: 'pawsewa-25997',
    storageBucket: 'pawsewa-25997.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAhgGruGWOoCX9R1TV5snyfgHJvFHtWHx8',
    appId: '1:188502859936:ios:16d550baeefa46d31ce9c5',
    messagingSenderId: '188502859936',
    projectId: 'pawsewa-25997',
    storageBucket: 'pawsewa-25997.firebasestorage.app',
    iosBundleId: 'com.pawsewa.userApp',
  );
}
