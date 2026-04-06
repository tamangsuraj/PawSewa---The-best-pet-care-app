import 'package:flutter/foundation.dart';

/// Drives a small "Live" badge on the notification bell while a call UI is open.
class OngoingCallService extends ChangeNotifier {
  bool active = false;
  String? label;

  void begin({String? label}) {
    active = true;
    this.label = label;
    notifyListeners();
  }

  void end() {
    active = false;
    label = null;
    notifyListeners();
  }
}
