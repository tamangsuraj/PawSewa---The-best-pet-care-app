import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/category_asset_fallback.dart';
import '../core/constants.dart';
import '../core/product_image_utils.dart';

/// Network product photo with ngrok-safe headers, caching, and category asset fallback.
class PartnerProductImage extends StatelessWidget {
  const PartnerProductImage({
    super.key,
    required this.product,
    required this.categoryName,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  final Map<String, dynamic> product;
  final String categoryName;
  final BoxFit fit;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final syncAbs = firstAbsoluteProductImageUrl(product);
    final rel = firstRelativeProductImagePath(product);

    Widget network(String url) {
      return CachedNetworkImage(
        imageUrl: url,
        httpHeaders: ngrokHeadersForImageUrl(url),
        fit: fit,
        width: double.infinity,
        height: double.infinity,
        alignment: Alignment.center,
        fadeInDuration: const Duration(milliseconds: 180),
        placeholder: (context, _) => const ColoredBox(
          color: Color(0xFFF6F1EC),
          child: Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: Color(AppConstants.primaryColor)),
            ),
          ),
        ),
        errorWidget: (context, u, e) => _CategoryFallbackImage(category: categoryName),
      );
    }

    if (syncAbs != null) {
      return ClipRRect(
        borderRadius: borderRadius ?? BorderRadius.zero,
        child: network(syncAbs),
      );
    }

    if (rel == null) {
      return ClipRRect(
        borderRadius: borderRadius ?? BorderRadius.zero,
        child: _CategoryFallbackImage(category: categoryName),
      );
    }

    return ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.zero,
      child: FutureBuilder<String?>(
        future: resolveProductImageUrl(product),
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const ColoredBox(
              color: Color(0xFFF6F1EC),
              child: Center(
                child: SizedBox(
                  width: 26,
                  height: 26,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(AppConstants.primaryColor)),
                ),
              ),
            );
          }
          final url = snap.data;
          if (url == null || url.isEmpty) {
            return _CategoryFallbackImage(category: categoryName);
          }
          return network(url);
        },
      ),
    );
  }
}

class _CategoryFallbackImage extends StatelessWidget {
  const _CategoryFallbackImage({required this.category});

  final String category;

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return FutureBuilder<String?>(
      future: CategoryAssetFallback.pickForCategory(category),
      builder: (context, snap) {
        final asset = snap.data;
        if (asset == null || asset.isEmpty) {
          return Icon(Icons.pets, size: 32, color: primary.withValues(alpha: 0.5));
        }
        return Image.asset(
          asset,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          errorBuilder: (context, error, stack) =>
              Icon(Icons.pets, size: 32, color: primary.withValues(alpha: 0.5)),
        );
      },
    );
  }
}
