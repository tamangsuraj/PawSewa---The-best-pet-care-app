import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api_client.dart';
import '../widgets/pawsewa_promo_modal.dart';

class PromotionModalService {
  PromotionModalService._();

  static const _dismissedIdKey = 'pawsewa_promo_dismissed_id';
  static bool _inFlight = false;

  static Future<void> maybeShow(BuildContext context) async {
    if (_inFlight) return;
    _inFlight = true;
    try {
      final resp = await ApiClient().dio.get('/promotions/active');
      final data = resp.data;
      if (data is! Map || data['success'] != true) return;
      final payload = data['data'];
      if (payload == null || payload is! Map) return;
      if (payload['active'] != true) return;

      final id = (payload['id'] ?? '').toString().trim();
      if (id.isEmpty) return;

      final prefs = await SharedPreferences.getInstance();
      final dismissed = (prefs.getString(_dismissedIdKey) ?? '').trim();
      if (dismissed == id) return;

      final title = (payload['title'] ?? '').toString().trim();
      final description = (payload['description'] ?? '').toString().trim();
      final promoCode = (payload['promoCode'] ?? '').toString().trim();
      final imageUrl = (payload['imageUrl'] ?? '').toString().trim();

      if (!context.mounted) return;

      await showPawSewaPromoModal(
        context,
        title: title.isEmpty ? 'Limited time offer' : title,
        offerText: promoCode.isNotEmpty ? '10% OFF' : 'New offer',
        subtitle: description.isEmpty ? null : description,
        promoCode: promoCode.isEmpty ? null : promoCode,
        promoHint: 'Applies to pre-payment only',
        ctaText: 'Order now',
        image: imageUrl.startsWith('http')
            ? NetworkImage(imageUrl)
            : const AssetImage('assets/brand/image_607767.png'),
        onCtaPressed: () async {
          await prefs.setString(_dismissedIdKey, id);
          if (context.mounted) Navigator.of(context).pop();
        },
      );

      await prefs.setString(_dismissedIdKey, id);
    } catch (_) {
      // Ignore network errors; modal remains hidden.
    } finally {
      _inFlight = false;
    }
  }
}

