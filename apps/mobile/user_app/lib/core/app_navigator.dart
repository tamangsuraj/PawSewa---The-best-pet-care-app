import 'package:flutter/material.dart';

/// Global navigator for auth / session flows (e.g. 401 → login) from non-widget code.
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();
