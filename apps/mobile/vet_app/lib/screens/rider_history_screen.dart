import 'package:flutter/material.dart';

import 'rider_delivery_orders_screen.dart';

/// Rider history — delivered drops & receipts. Opens the delivery screen
/// pre-filtered to delivered/completed orders.
class RiderHistoryScreen extends StatelessWidget {
  const RiderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      const RiderDeliveryOrdersScreen(initialFilter: 'delivered');
}

