import 'package:flutter/material.dart';

import '../widgets/partner_scaffold.dart';
import 'rider_delivery_orders_screen.dart';

/// Dedicated history view (delivered deliveries) without placeholder screens.
class RiderHistoryScreen extends StatelessWidget {
  const RiderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PartnerScaffold(
      title: 'Delivery history',
      subtitle: 'Delivered drops & receipts',
      body: const RiderDeliveryOrdersScreen(),
    );
  }
}

