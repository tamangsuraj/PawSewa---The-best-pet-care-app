import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../../cart/cart_service.dart';
import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../cart/delivery_pin_screen.dart';

// Delivery fee and free delivery threshold
const double kDeliveryFee = 80;
const double kFreeDeliveryAbove = 1000;

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  final _apiClient = ApiClient();

  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _products = [];
  String _selectedCategorySlug = '';
  String _selectedCategoryName = 'All';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  Future<void> _loadInitial() async {
    try {
      setState(() {
        _loading = true;
        _error = null;
      });
      final respCats = await _apiClient.getCategories();
      final respProds = await _apiClient.getProducts();
      if (!mounted) return;
      final cats = List<Map<String, dynamic>>.from(
        (respCats.data['data'] as List<dynamic>? ?? []),
      );
      final prods = List<Map<String, dynamic>>.from(
        (respProds.data['data'] as List<dynamic>? ?? []),
      );
      setState(() {
        _categories = cats;
        _products = prods;
        _selectedCategorySlug = '';
        _selectedCategoryName = 'All';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load shop: $e';
      });
    }
  }

  Future<void> _loadProductsByCategory(String slug) async {
    try {
      setState(() => _loading = true);
      final resp = await _apiClient.getProducts(
        category: slug.isEmpty ? null : slug,
      );
      if (!mounted) return;
      final prods = List<Map<String, dynamic>>.from(
        (resp.data['data'] as List<dynamic>? ?? []),
      );
      final cat = _categories.cast<Map<String, dynamic>?>().firstWhere(
            (c) => (c?['slug'] ?? '') == slug,
            orElse: () => null,
          );
      setState(() {
        _products = prods;
        _selectedCategorySlug = slug;
        _selectedCategoryName = cat?['name']?.toString() ?? slug;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load products: $e';
      });
    }
  }

  void _openProductDetail(Map<String, dynamic> product) {
    HapticFeedback.lightImpact();
    final cart = context.read<CartService>();
    showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _AddToBasketSheet(product: product),
    ).then((qty) {
      if (qty != null && qty > 0) {
        final id = product['_id']?.toString() ?? '';
        final name = product['name']?.toString() ?? 'Product';
        final price = (product['price'] as num?)?.toDouble() ?? 0;
        for (var i = 0; i < qty; i++) {
          cart.addItem(productId: id, name: name, price: price);
        }
      }
    });
  }

  void _openCheckout() {
    final cart = context.read<CartService>();
    if (cart.items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Your basket is empty.', style: GoogleFonts.poppins()),
        ),
      );
      return;
    }
    final subtotal = cart.subtotal;
    final delivery = subtotal >= kFreeDeliveryAbove ? 0.0 : kDeliveryFee;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CheckoutSheet(
        subtotal: subtotal,
        deliveryFee: delivery,
        grandTotal: subtotal + delivery,
        onAddAddress: _openAddAddressSheet,
        onApplyPromo: _openPromoSheet,
        onSelectPayment: () => _openPaymentSheet(subtotal + delivery),
      ),
    );
  }

  void _openAddAddressSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const _AddAddressSheet(),
    );
  }

  void _openPromoSheet() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const _PromoSheet(),
    );
  }

  void _openPaymentSheet(double amount) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _PaymentSheet(
        amount: amount,
        onConfirmed: () {
          Navigator.of(ctx).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Payment method selected.',
                style: GoogleFonts.poppins(),
              ),
            ),
          );
        },
      ),
    );
  }

  String _categorySubtitle() {
    if (_selectedCategorySlug.isEmpty) return 'Browse our products.';
    switch (_selectedCategorySlug.toLowerCase()) {
      case 'pet-food':
        return 'Balanced meals tailored for dogs and cats.';
      case 'medicines':
        return 'Vet-approved essentials for safe treatment.';
      case 'grooming':
        return 'Keep coats shiny, skin calm, and paws clean.';
      case 'accessories':
        return 'Comfortable, durable daily-use gear.';
      default:
        return 'Everyday supplies your pet depends on.';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<CartService>(
      builder: (context, cart, _) {
        final totalItems = cart.items.values.fold<int>(
          0,
          (sum, item) => sum + item.quantity,
        );
        final subtotal = cart.subtotal;
        final delivery = subtotal >= kFreeDeliveryAbove ? 0.0 : kDeliveryFee;
        final grandTotal = subtotal + delivery;

        return Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: Stack(
              children: [
                CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(child: _buildDeliveryHeader()),
                    SliverToBoxAdapter(
                      child: _CategoryCircleStrip(
                        categories: _categories,
                        selectedSlug: _selectedCategorySlug,
                        products: _products,
                        onChanged: _loadProductsByCategory,
                      ),
                    ),
                    SliverToBoxAdapter(child: _buildSectionTitle()),
                    _loading
                        ? const SliverFillRemaining(
                            child: Center(
                              child: CircularProgressIndicator(
                                color: Color(AppConstants.primaryColor),
                              ),
                            ),
                          )
                        : _error != null
                            ? SliverFillRemaining(
                                child: Center(
                                  child: Padding(
                                    padding: const EdgeInsets.all(24),
                                    child: Text(
                                      _error!,
                                      style: GoogleFonts.poppins(
                                        color: Colors.red,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                  ),
                                ),
                              )
                            : _products.isEmpty
                                ? SliverFillRemaining(
                                    child: Center(
                                      child: Text(
                                        'No products found.',
                                        style: GoogleFonts.poppins(
                                          color: Colors.grey[600],
                                        ),
                                      ),
                                    ),
                                  )
                                : SliverPadding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 8,
                                    ),
                                    sliver: SliverGrid(
                                      gridDelegate:
                                          const SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: 2,
                                        mainAxisSpacing: 12,
                                        crossAxisSpacing: 12,
                                        childAspectRatio: 0.68,
                                      ),
                                      delegate: SliverChildBuilderDelegate(
                                        (context, index) {
                                          final p = _products[index];
                                          return _ProductCard(
                                            product: p,
                                            onTap: () => _openProductDetail(p),
                                            onAddToCart: () => _openProductDetail(p),
                                          );
                                        },
                                        childCount: _products.length,
                                      ),
                                    ),
                                  ),
                    const SliverToBoxAdapter(child: SizedBox(height: 100)),
                  ],
                ),
                if (totalItems > 0)
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 16,
                    child: _FloatingCartBar(
                      totalItems: totalItems,
                      subtotal: grandTotal,
                      onTap: _openCheckout,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDeliveryHeader() {
    const primary = Color(AppConstants.primaryColor);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Delivering within ',
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  color: Colors.black87,
                ),
              ),
              Text(
                'a day',
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.access_time_rounded, size: 16, color: Colors.grey[700]),
              const SizedBox(width: 4),
              Text(
                '10:00 AM to 5:00 PM',
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  color: Colors.grey[700],
                ),
              ),
              const SizedBox(width: 6),
              Text('•', style: TextStyle(fontSize: 12, color: Colors.grey[700])),
              const SizedBox(width: 6),
              Icon(Icons.delivery_dining_rounded,
                  size: 16, color: Colors.grey[700]),
              const SizedBox(width: 4),
              Text(
                'Rs. ${kDeliveryFee.toInt()}',
                style: GoogleFonts.poppins(
                  fontSize: 12,
                  color: Colors.grey[700],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF7EFE8),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: primary.withValues(alpha: 0.55),
                width: 0.9,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.percent_rounded,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Free delivery',
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: primary,
                        ),
                      ),
                      Text(
                        'Enjoy FREE delivery on orders above Rs. ${kFreeDeliveryAbove.toInt()}',
                        style: GoogleFonts.poppins(
                          fontSize: 11,
                          color: Colors.grey[800],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildSectionTitle() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _selectedCategoryName,
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.w800,
              fontSize: 18,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _categorySubtitle(),
            style: GoogleFonts.poppins(
              fontSize: 12,
              color: Colors.grey[700],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Category strip (horizontal, circular icons) ────────────────────────────

class _CategoryCircleStrip extends StatelessWidget {
  final List<Map<String, dynamic>> categories;
  final String selectedSlug;
  final List<Map<String, dynamic>> products;
  final ValueChanged<String> onChanged;

  const _CategoryCircleStrip({
    required this.categories,
    required this.selectedSlug,
    required this.products,
    required this.onChanged,
  });

  String? _firstImageForCategory(String? slug) {
    if (slug == null || slug.isEmpty) return null;
    for (final p in products) {
      final cat = p['category'];
      final catSlug = cat is Map ? cat['slug']?.toString() : null;
      if (catSlug == slug) {
        final imgs = p['images'] as List<dynamic>?;
        if (imgs != null && imgs.isNotEmpty) {
          return imgs.first.toString();
        }
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final allCat = <Map<String, dynamic>>[
      {'slug': '', 'name': 'All'},
      ...categories,
    ];
    return SizedBox(
      height: 100,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        scrollDirection: Axis.horizontal,
        itemCount: allCat.length,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final c = allCat[index];
          final slug = c['slug']?.toString() ?? '';
          final name = c['name']?.toString() ?? slug;
          final isActive = slug == selectedSlug;
          final imageUrl = slug.isEmpty ? null : _firstImageForCategory(slug);
          return GestureDetector(
            onTap: () => onChanged(slug),
            child: SizedBox(
              width: 70,
              child: Column(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isActive ? primary : Colors.grey.shade300,
                        width: isActive ? 2.5 : 1,
                      ),
                    ),
                    child: ClipOval(
                      child: imageUrl != null
                          ? CachedNetworkImage(
                              imageUrl: imageUrl,
                              fit: BoxFit.cover,
                              width: 60,
                              height: 60,
                              placeholder: (context, url) => Container(
                                color: const Color(0xFFF5F0EB),
                                child: Icon(Icons.pets, color: primary),
                              ),
                              errorWidget: (context, error, stackTrace) => Container(
                                color: const Color(0xFFF5F0EB),
                                child: Icon(Icons.pets, color: primary),
                              ),
                            )
                          : Container(
                              color: const Color(0xFFF5F0EB),
                              child: Icon(
                                slug.isEmpty ? Icons.grid_view : Icons.pets,
                                color: primary,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    name,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.poppins(
                      fontSize: 10,
                      fontWeight:
                          isActive ? FontWeight.w700 : FontWeight.w500,
                      color: isActive ? Colors.black87 : Colors.grey[700],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─── Product card ───────────────────────────────────────────────────────────

class _ProductCard extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback onTap;
  final VoidCallback onAddToCart;

  const _ProductCard({
    required this.product,
    required this.onTap,
    required this.onAddToCart,
  });

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final images = product['images'] as List<dynamic>? ?? [];
    final imageUrl = images.isNotEmpty ? images.first.toString() : null;
    final name = product['name']?.toString() ?? 'Product';
    final desc = product['description']?.toString() ?? '';
    final price = (product['price'] as num?)?.toDouble() ?? 0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 3,
            child: GestureDetector(
              onTap: onTap,
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFFF6F1EC),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: imageUrl != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                          placeholder: (context, url) => Center(
                            child: Icon(Icons.pets, color: primary),
                          ),
                          errorWidget: (context, error, stackTrace) => Center(
                            child: Icon(Icons.pets, color: primary),
                          ),
                        ),
                      )
                    : Center(child: Icon(Icons.pets, color: primary)),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (desc.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    desc.length > 40 ? '${desc.substring(0, 40)}...' : desc,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
                const SizedBox(height: 6),
                Row(
                  children: [
                    Text(
                      'Rs. ${price.toStringAsFixed(0)}',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: onAddToCart,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: primary,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: primary.withValues(alpha: 0.4),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.add,
                          size: 18,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

// ─── Floating cart bar ──────────────────────────────────────────────────────

class _FloatingCartBar extends StatelessWidget {
  final int totalItems;
  final double subtotal;
  final VoidCallback onTap;

  const _FloatingCartBar({
    required this.totalItems,
    required this.subtotal,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: primary,
          borderRadius: BorderRadius.circular(999),
          boxShadow: [
            BoxShadow(
              color: primary.withValues(alpha: 0.4),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Text(
              '$totalItems item${totalItems == 1 ? '' : 's'}',
              style: GoogleFonts.poppins(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 4,
              height: 4,
              decoration: const BoxDecoration(
                color: Colors.white70,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'Rs. ${subtotal.toStringAsFixed(2)}/-',
              style: GoogleFonts.poppins(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
            const Spacer(),
            Text(
              'View basket',
              style: GoogleFonts.poppins(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 16,
              color: Colors.white,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Add to basket bottom sheet ─────────────────────────────────────────────

class _AddToBasketSheet extends StatefulWidget {
  final Map<String, dynamic> product;

  const _AddToBasketSheet({required this.product});

  @override
  State<_AddToBasketSheet> createState() => _AddToBasketSheetState();
}

class _AddToBasketSheetState extends State<_AddToBasketSheet> {
  int _qty = 1;

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final images = widget.product['images'] as List<dynamic>? ?? [];
    final imageUrl = images.isNotEmpty ? images.first.toString() : null;
    final name = widget.product['name']?.toString() ?? 'Product';
    final desc = widget.product['description']?.toString() ?? '';
    final price = (widget.product['price'] as num?)?.toDouble() ?? 0;

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      maxChildSize: 0.8,
      minChildSize: 0.45,
      builder: (context, controller) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Add item to basket',
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  children: [
                    Container(
                      height: 180,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF6F1EC),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: imageUrl != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: CachedNetworkImage(
                                imageUrl: imageUrl,
                                fit: BoxFit.contain,
                                placeholder: (context, url) =>
                                    Center(child: Icon(Icons.pets, color: primary)),
                                errorWidget: (context, error, stackTrace) =>
                                    Center(child: Icon(Icons.pets, color: primary)),
                              ),
                            )
                          : Center(child: Icon(Icons.pets, size: 60, color: primary)),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      name,
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                      ),
                    ),
                    if (desc.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        desc.length > 50 ? '${desc.substring(0, 50)}...' : desc,
                        style: GoogleFonts.poppins(
                          fontSize: 13,
                          color: Colors.grey[700],
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Text(
                      'Rs. ${price.toStringAsFixed(0)}',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Text(
                          'Quantity',
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        const Spacer(),
                        _QtyPill(
                          qty: _qty,
                          onMinus: () {
                            if (_qty > 1) setState(() => _qty--);
                          },
                          onPlus: () => setState(() => _qty++),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      Navigator.of(context).pop(_qty);
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      decoration: BoxDecoration(
                        color: primary,
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: [
                          BoxShadow(
                            color: primary.withValues(alpha: 0.4),
                            blurRadius: 18,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Add to basket • Rs. ${(price * _qty).toStringAsFixed(0)}',
                        style: GoogleFonts.poppins(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _QtyPill extends StatelessWidget {
  final int qty;
  final VoidCallback onMinus;
  final VoidCallback onPlus;

  const _QtyPill({
    required this.qty,
    required this.onMinus,
    required this.onPlus,
  });

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return Container(
      height: 28,
      decoration: BoxDecoration(
        color: const Color(0xFFF7F3EF),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          InkWell(
            onTap: onMinus,
            customBorder: const CircleBorder(),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Icon(Icons.remove, size: 14, color: primary),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              '$qty',
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
          InkWell(
            onTap: onPlus,
            customBorder: const CircleBorder(),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Icon(Icons.add, size: 14, color: primary),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Checkout sheet ─────────────────────────────────────────────────────────

class _CheckoutSheet extends StatefulWidget {
  final double subtotal;
  final double deliveryFee;
  final double grandTotal;
  final VoidCallback onAddAddress;
  final VoidCallback onApplyPromo;
  final VoidCallback onSelectPayment;

  const _CheckoutSheet({
    required this.subtotal,
    required this.deliveryFee,
    required this.grandTotal,
    required this.onAddAddress,
    required this.onApplyPromo,
    required this.onSelectPayment,
  });

  @override
  State<_CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<_CheckoutSheet> {
  String _selectedDay = 'Today';
  String _selectedSlot = 'As soon as possible';

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final cart = context.read<CartService>();
    final entries = cart.items.values.toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      maxChildSize: 0.96,
      minChildSize: 0.7,
      builder: (context, controller) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Text(
                      'Checkout & confirmation',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  children: [
                    GestureDetector(
                      onTap: widget.onAddAddress,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.add_location_alt_outlined, color: primary),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                cart.deliveryAddress ?? 'Add delivery address',
                                style: GoogleFonts.poppins(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Icon(Icons.chevron_right_rounded,
                                color: Colors.black45),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'Delivery date & time',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _dayChip('Today'),
                        const SizedBox(width: 8),
                        _dayChip('Tomorrow'),
                        const SizedBox(width: 8),
                        _dayChip('Day after'),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _slotChip('As soon as possible'),
                        _slotChip('10:00–11:00'),
                        _slotChip('13:00–14:00'),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'Your items (${entries.length})',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...entries.map((item) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF6F1EC),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              alignment: Alignment.center,
                              child: Icon(Icons.pets, color: primary),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.name,
                                    style: GoogleFonts.poppins(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    'Rs. ${item.price.toStringAsFixed(0)}',
                                    style: GoogleFonts.poppins(
                                      fontSize: 12,
                                      color: Colors.grey[700],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            _QtyPill(
                              qty: item.quantity,
                              onMinus: () {
                                cart.updateQuantity(
                                    item.productId, item.quantity - 1);
                              },
                              onPlus: () {
                                cart.updateQuantity(
                                    item.productId, item.quantity + 1);
                              },
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 18),
                    Text(
                      'Promo code',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: widget.onApplyPromo,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.local_offer_outlined, color: primary),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Apply promo code',
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            Icon(Icons.chevron_right_rounded,
                                color: Colors.black45),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'Bill details',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _billRow('Items total', widget.subtotal),
                    const SizedBox(height: 4),
                    _billRow('Delivery charge', widget.deliveryFee),
                    const SizedBox(height: 6),
                    const Divider(height: 1, color: Color(0xFFE3E0DD)),
                    const SizedBox(height: 6),
                    _billRow('Grand total', widget.grandTotal, isEmphasis: true),
                    const SizedBox(height: 18),
                    Text(
                      'Payment method',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: widget.onSelectPayment,
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.credit_card_outlined, color: primary),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Select payment method',
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            Icon(Icons.chevron_right_rounded,
                                color: Colors.black45),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 80),
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    onPressed: () {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            'Order review complete.',
                            style: GoogleFonts.poppins(),
                          ),
                        ),
                      );
                    },
                    child: Text(
                      'Confirm order',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _dayChip(String label) {
    const primary = Color(AppConstants.primaryColor);
    final isSelected = _selectedDay == label;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedDay = label),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: isSelected ? const Color(0xFFF6F1EC) : Colors.white,
            border: Border.all(
              color: isSelected ? primary : const Color(0xFFE3E0DD),
              width: isSelected ? 1.4 : 1.0,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label.toUpperCase(),
                style: GoogleFonts.poppins(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? primary : Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 2),
              Text(
                label == 'Today'
                    ? 'Selected'
                    : label == 'Tomorrow'
                        ? 'Next day'
                        : 'Later',
                style: GoogleFonts.poppins(
                  fontSize: 10,
                  color: Colors.grey[700],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _slotChip(String label) {
    const primary = Color(AppConstants.primaryColor);
    final isSelected = _selectedSlot == label;
    return GestureDetector(
      onTap: () => setState(() => _selectedSlot = label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: isSelected ? const Color(0xFFF6F1EC) : Colors.white,
          border: Border.all(
            color: isSelected ? primary : const Color(0xFFE3E0DD),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            color: isSelected ? primary : Colors.black87,
          ),
        ),
      ),
    );
  }

  Widget _billRow(String label, double amount, {bool isEmphasis = false}) {
    return Row(
      children: [
        Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 13,
            fontWeight: isEmphasis ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        const Spacer(),
        Text(
          'Rs. ${amount.toStringAsFixed(0)}',
          style: GoogleFonts.poppins(
            fontSize: isEmphasis ? 15 : 13,
            fontWeight: isEmphasis ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ─── Add address sheet (with map) ───────────────────────────────────────────

class _AddAddressSheet extends StatefulWidget {
  const _AddAddressSheet();

  @override
  State<_AddAddressSheet> createState() => _AddAddressSheetState();
}

class _AddAddressSheetState extends State<_AddAddressSheet> {
  final _addressTitleController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  LatLng _pin = const LatLng(27.7172, 85.3240);
  String? _address;
  bool _loadingAddress = false;
  final MapController _mapController = MapController();

  @override
  void dispose() {
    _addressTitleController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _reverseGeocode(LatLng point) async {
    setState(() {
      _loadingAddress = true;
      _address = null;
    });
    try {
      final dio = Dio(
        BaseOptions(
          baseUrl: 'https://nominatim.openstreetmap.org',
          headers: const {
            'User-Agent': 'PawSewa Mobile App (pawsewa.app)',
          },
        ),
      );
      final resp = await dio.get(
        '/reverse',
        queryParameters: {
          'format': 'jsonv2',
          'lat': point.latitude.toString(),
          'lon': point.longitude.toString(),
        },
      );
      final data = resp.data as Map<String, dynamic>;
      final addr = data['display_name']?.toString();
      if (mounted) {
        setState(() {
          _address = addr;
          _loadingAddress = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _address = null;
          _loadingAddress = false;
        });
      }
    }
  }

  Future<void> _openFullMapPicker() async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => const DeliveryPinScreen(),
      ),
    );
    if (result == true && mounted) {
      final cart = context.read<CartService>();
      setState(() {
        _address = cart.deliveryAddress;
        if (cart.deliveryLat != null && cart.deliveryLng != null) {
          _pin = LatLng(cart.deliveryLat!, cart.deliveryLng!);
        }
      });
    }
  }

  void _onMapTap(TapPosition tap, LatLng point) {
    setState(() => _pin = point);
    _reverseGeocode(point);
  }

  void _saveAddress() {
    if (_addressTitleController.text.trim().isEmpty ||
        _nameController.text.trim().isEmpty ||
        _phoneController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please fill all required fields.',
            style: GoogleFonts.poppins(),
          ),
        ),
      );
      return;
    }
    context.read<CartService>().setDeliveryLocation(
          lat: _pin.latitude,
          lng: _pin.longitude,
          address: _address ?? '${_pin.latitude}, ${_pin.longitude}',
        );
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Address saved.',
          style: GoogleFonts.poppins(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.6,
      builder: (context, controller) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                    Text(
                      'Add address',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  children: [
                    SizedBox(
                      height: 170,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: FlutterMap(
                          mapController: _mapController,
                          options: MapOptions(
                            initialCenter: _pin,
                            initialZoom: 14,
                            onTap: _onMapTap,
                          ),
                          children: [
                            TileLayer(
                              urlTemplate:
                                  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                              subdomains: const ['a', 'b', 'c'],
                              userAgentPackageName: 'com.pawsewa.user_app',
                            ),
                            MarkerLayer(
                              markers: [
                                Marker(
                                  point: _pin,
                                  width: 36,
                                  height: 36,
                                  child: Icon(
                                    Icons.location_on,
                                    color: primary,
                                    size: 36,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _loadingAddress
                              ? Text(
                                  'Fetching address…',
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    color: Colors.grey[700],
                                  ),
                                )
                              : Text(
                                  _address ?? 'Tap map or set location',
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    color: Colors.grey[800],
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                        ),
                        TextButton(
                          onPressed: _openFullMapPicker,
                          child: Text(
                            'SET LOCATION',
                            style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w700,
                              color: primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _addressTitleController,
                      decoration: InputDecoration(
                        labelText: 'Address title e.g. Home, Clinic *',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _nameController,
                      decoration: InputDecoration(
                        labelText: 'Full name *',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: 'Mobile number *',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                    onPressed: _saveAddress,
                    child: Text(
                      'SAVE ADDRESS',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Promo sheet ────────────────────────────────────────────────────────────

class _PromoSheet extends StatelessWidget {
  const _PromoSheet();

  @override
  Widget build(BuildContext context) {
    final controller = TextEditingController();
    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      maxChildSize: 0.75,
      minChildSize: 0.4,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Use promo code',
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: controller,
                            decoration: InputDecoration(
                              hintText: 'Enter promo code',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 12,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () {
                            if (controller.text.trim().isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Enter a code to apply.'),
                                ),
                              );
                              return;
                            }
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Promo validation coming soon.',
                                  style: GoogleFonts.poppins(),
                                ),
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.grey.shade300,
                            foregroundColor: Colors.grey.shade700,
                          ),
                          child: const Text('APPLY'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 40),
                    Column(
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          alignment: Alignment.center,
                          child: Icon(
                            Icons.local_activity_outlined,
                            size: 32,
                            color: Colors.grey[600],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No available promos',
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            color: Colors.grey[700],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Payment sheet ──────────────────────────────────────────────────────────

class _PaymentSheet extends StatefulWidget {
  final double amount;
  final VoidCallback onConfirmed;

  const _PaymentSheet({
    required this.amount,
    required this.onConfirmed,
  });

  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  String _selected = 'Cash on Delivery';

  static const List<Map<String, String>> _localMethods = [
    {'id': 'Cash on Delivery', 'name': 'Cash on Delivery'},
    {'id': 'Fonepay', 'name': 'Fonepay'},
    {'id': 'eSewa', 'name': 'E-Sewa'},
    {'id': 'Connect IPS', 'name': 'Connect IPS'},
    {'id': 'Khalti', 'name': 'Khalti'},
    {'id': 'Credit/Debit Card', 'name': 'Credit/Debit Card'},
    {'id': 'Nepal Pay', 'name': 'Nepal Pay'},
  ];

  static const List<Map<String, String>> _internationalMethods = [
    {'id': 'PayPal', 'name': 'PayPal'},
    {'id': 'International Card', 'name': 'Credit/Debit Card'},
  ];

  IconData _iconFor(String id) {
    switch (id.toLowerCase()) {
      case 'cash on delivery':
        return Icons.money;
      case 'paypal':
        return Icons.payment;
      case 'khalti':
      case 'esewa':
      case 'nepal pay':
        return Icons.account_balance_wallet;
      case 'fonepay':
        return Icons.phone_android;
      case 'connect ips':
        return Icons.account_balance;
      case 'credit/debit card':
      case 'international card':
        return Icons.credit_card;
      default:
        return Icons.payment;
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      minChildSize: 0.7,
      builder: (context, controller) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded),
                    ),
                    Text(
                      'Payment Method',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView(
                  controller: controller,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    Text(
                      'Local Users',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 16),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        childAspectRatio: 0.85,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                      ),
                      itemCount: _localMethods.length,
                      itemBuilder: (context, index) {
                        final m = _localMethods[index];
                        final isSelected = _selected == m['id'];
                        return GestureDetector(
                          onTap: () => setState(() => _selected = m['id']!),
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected
                                    ? primary
                                    : Colors.grey.shade300,
                                width: isSelected ? 2 : 1,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: isSelected
                                      ? primary.withValues(alpha: 0.1)
                                      : Colors.black.withValues(alpha: 0.04),
                                  blurRadius: isSelected ? 12 : 8,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 50,
                                  height: 50,
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    _iconFor(m['id']!),
                                    size: 28,
                                    color: isSelected
                                        ? primary
                                        : Colors.grey[600],
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  m['name']!,
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.poppins(
                                    fontSize: 12,
                                    fontWeight:
                                        isSelected ? FontWeight.w600 : FontWeight.w500,
                                    color: isSelected ? primary : Colors.black87,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                if (isSelected)
                                  Container(
                                    width: 20,
                                    height: 20,
                                    decoration: BoxDecoration(
                                      color: primary,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.check,
                                      size: 14,
                                      color: Colors.white,
                                    ),
                                  )
                                else
                                  Container(
                                    width: 20,
                                    height: 20,
                                    decoration: BoxDecoration(
                                      border: Border.all(
                                        color: Colors.grey.shade400,
                                      ),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'International Users',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w600,
                        fontSize: 16,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 16),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        childAspectRatio: 0.85,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                      ),
                      itemCount: _internationalMethods.length,
                      itemBuilder: (context, index) {
                        final m = _internationalMethods[index];
                        final isSelected = _selected == m['id'];
                        return GestureDetector(
                          onTap: () => setState(() => _selected = m['id']!),
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected
                                    ? primary
                                    : Colors.grey.shade300,
                                width: isSelected ? 2 : 1,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: isSelected
                                      ? primary.withValues(alpha: 0.1)
                                      : Colors.black.withValues(alpha: 0.04),
                                  blurRadius: isSelected ? 12 : 8,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 50,
                                  height: 50,
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade50,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    _iconFor(m['id']!),
                                    size: 28,
                                    color: isSelected
                                        ? primary
                                        : Colors.grey[600],
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  m['name']!,
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.poppins(
                                    fontSize: 12,
                                    fontWeight:
                                        isSelected ? FontWeight.w600 : FontWeight.w500,
                                    color: isSelected ? primary : Colors.black87,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                if (isSelected)
                                  Container(
                                    width: 20,
                                    height: 20,
                                    decoration: BoxDecoration(
                                      color: primary,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.check,
                                      size: 14,
                                      color: Colors.white,
                                    ),
                                  )
                                else
                                  Container(
                                    width: 20,
                                    height: 20,
                                    decoration: BoxDecoration(
                                      border: Border.all(
                                        color: Colors.grey.shade400,
                                      ),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 100),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: SafeArea(
                  top: false,
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Text(
                            'Total Amount',
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              color: Colors.black54,
                            ),
                          ),
                          const Spacer(),
                          Text(
                            'Rs. ${widget.amount.toStringAsFixed(0)}',
                            style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w700,
                              fontSize: 18,
                              color: Colors.black87,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primary,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                          onPressed: widget.onConfirmed,
                          child: Text(
                            'Confirm Payment Method',
                            style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
