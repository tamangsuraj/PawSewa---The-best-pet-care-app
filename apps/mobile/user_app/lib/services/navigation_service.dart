import '../core/app_navigator.dart';

/// Global navigator access for push handlers (FCM, API interceptors).
class NavigationService {
  static final navigatorKey = appNavigatorKey;
}
