import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import 'package:url_launcher/url_launcher.dart';

import '../../cart/cart_service.dart';
import '../../core/api_client.dart';
import '../../core/api_config.dart';
import '../../core/constants.dart';
import '../cart/delivery_pin_screen.dart';

// Delivery fee and free delivery threshold
const double kDeliveryFee = 80;
const double kFreeDeliveryAbove = 1000;

// Hardcoded Favourites "category" – cannot be created/destroyed from admin
const String kFavouritesSlug = '__favourites__';

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
  String _searchQuery = '';
  String? _filterCategory;
  double? _filterMinPrice;
  double? _filterMaxPrice;
  final Set<String> _favouriteIds = {};
  final TextEditingController _searchController = TextEditingController();

  void _onSearchChanged() => setState(() {});

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onSearchChanged);
    _loadInitial();
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadInitial({bool isRetry = false}) async {
    try {
      setState(() {
        _loading = true;
        _error = null;
      });
      // Load products first so we can show them even if categories fail
      final respProds = await _apiClient.getProducts();
      if (!mounted) return;
      List<Map<String, dynamic>> prods = _parseListFromResponse(respProds.data);

      List<Map<String, dynamic>> cats = [];
      try {
        final respCats = await _apiClient.getCategories();
        if (mounted) {
          cats = _parseListFromResponse(respCats.data);
        }
      } catch (_) {
        // Categories optional: still show products with "All" only
        if (kDebugMode) {
          debugPrint('[Shop] Categories failed, showing products only');
        }
      }

      Set<String> favIds = {};
      try {
        final respFav = await _apiClient.getFavourites();
        if (mounted && respFav.data is Map && respFav.data['data'] is List) {
          for (final p in respFav.data['data'] as List) {
            if (p is Map && p['_id'] != null) {
              favIds.add(p['_id'].toString());
            }
          }
        }
      } catch (_) {
        if (kDebugMode) {
          debugPrint('[Shop] Favourites failed (e.g. not logged in)');
        }
      }

      if (!mounted) return;
      setState(() {
        _categories = cats;
        _products = prods;
        _selectedCategorySlug = '';
        _selectedCategoryName = 'All';
        _loading = false;
        _favouriteIds.clear();
        _favouriteIds.addAll(favIds);
      });
    } catch (e) {
      if (kDebugMode && e is DioException) {
        if (e.type == DioExceptionType.badResponse) {
          debugPrint('[Shop] STATUS: ${e.response?.statusCode}');
          debugPrint('[Shop] DATA: ${e.response?.data}');
        }
      }
      if (!mounted) return;
      final isConnectionError =
          e is DioException &&
          (e.type == DioExceptionType.connectionError ||
              e.type == DioExceptionType.connectionTimeout ||
              e.type == DioExceptionType.receiveTimeout ||
              e.type == DioExceptionType.sendTimeout);
      if (isConnectionError && !isRetry) {
        // Auto-retry once after delay (e.g. backend was still starting)
        await Future<void>.delayed(const Duration(seconds: 2));
        if (!mounted) return;
        _loadInitial(isRetry: true);
        return;
      }
      setState(() {
        _loading = false;
        _error = _friendlyShopError(e);
        _lastErrorWasConnection = isConnectionError;
      });
    }
  }

  bool _lastErrorWasConnection = false;

  Future<void> _showSetServerUrlDialog() async {
    final currentHost = await ApiConfig.getHost();
    final controller = TextEditingController(text: currentHost);

    if (!mounted) return;
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Set server URL'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Local: Enter PC IP from ipconfig.\n\n'
                'Anywhere: Run npm run tunnel, paste the ngrok URL.',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: const InputDecoration(
                  labelText: 'IP or ngrok URL',
                  border: OutlineInputBorder(),
                  hintText: '192.168.1.5 or https://xxx.ngrok-free.app',
                ),
                keyboardType: TextInputType.url,
                autofocus: true,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (saved == true && mounted) {
      await ApiConfig.setHost(controller.text);
      await ApiClient().reinitialize();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Server URL saved. Retrying...'),
            backgroundColor: Colors.green,
          ),
        );
        setState(() => _error = null);
        _loadInitial();
      }
    }
  }

  static List<Map<String, dynamic>> _parseListFromResponse(dynamic data) {
    if (data is! Map) return [];
    final raw = data['data'];
    if (raw is List) {
      return raw
          .map(
            (e) =>
                e is Map ? Map<String, dynamic>.from(e) : <String, dynamic>{},
          )
          .toList();
    }
    return [];
  }

  static String _friendlyShopError(Object e) {
    if (e is DioException) {
      final msg = e.error?.toString();
      if (msg != null && msg.isNotEmpty && msg != 'null') {
        return msg;
      }
      final data = e.response?.data;
      if (data is Map && data['message'] != null) {
        return data['message'].toString();
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout) {
        return 'Request timed out. Tap Retry or Set server URL below.';
      }
      if (e.type == DioExceptionType.connectionError) {
        return 'Cannot reach the server. Tap Retry or Set server URL below.';
      }
      if (e.type == DioExceptionType.badResponse) {
        final code = e.response?.statusCode ?? 0;
        if (code >= 500) {
          return 'Server is busy or unreachable. Please try again in a moment.';
        }
        if (code == 401) {
          return 'Please sign in again to view the shop.';
        }
        return 'Could not load shop. Please try again.';
      }
    }
    return 'Could not load shop. Please check your connection and try again.';
  }

  Future<void> _loadProductsByCategory(String slug) async {
    try {
      setState(() => _loading = true);
      List<Map<String, dynamic>> prods;
      if (slug == kFavouritesSlug) {
        final resp = await _apiClient.getFavourites(
          search: _searchQuery.isEmpty ? null : _searchQuery,
          category: _filterCategory,
          minPrice: _filterMinPrice,
          maxPrice: _filterMaxPrice,
        );
        if (!mounted) return;
        prods = _parseListFromResponse(resp.data);
      } else {
        final resp = await _apiClient.getProducts(
          category: slug.isEmpty ? null : slug,
          search: _searchQuery.isEmpty ? null : _searchQuery,
          minPrice: _filterMinPrice,
          maxPrice: _filterMaxPrice,
        );
        if (!mounted) return;
        prods = _parseListFromResponse(resp.data);
      }
      String name = slug.isEmpty ? 'All' : slug;
      if (slug == kFavouritesSlug) {
        name = 'Favourites';
      } else {
        for (final c in _categories) {
          if ((c['slug'] ?? '') == slug) {
            name = c['name']?.toString() ?? slug;
            break;
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _products = prods;
        _selectedCategorySlug = slug;
        _selectedCategoryName = name;
        _loading = false;
      });
    } catch (e) {
      if (kDebugMode && e is DioException) {
        if (e.type == DioExceptionType.badResponse) {
          debugPrint('[Shop] STATUS: ${e.response?.statusCode}');
          debugPrint('[Shop] DATA: ${e.response?.data}');
        }
      }
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _friendlyShopError(e);
      });
    }
  }

  Future<void> _showFilterSheet() async {
    final minController = TextEditingController(
      text: _filterMinPrice != null ? _filterMinPrice!.toInt().toString() : '',
    );
    final maxController = TextEditingController(
      text: _filterMaxPrice != null ? _filterMaxPrice!.toInt().toString() : '',
    );
    final chosen = await showModalBottomSheet<Map<String, dynamic>?>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) => SafeArea(
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'Filter by category & price',
                      style: GoogleFonts.poppins(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'Category',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey,
                      ),
                    ),
                  ),
                  ListTile(
                    title: const Text('All categories'),
                    onTap: () => Navigator.of(ctx).pop({
                      'category': null,
                      'minPrice': _parsePrice(minController.text),
                      'maxPrice': _parsePrice(maxController.text),
                    }),
                  ),
                  ..._categories.map((c) {
                    final slug = c['slug']?.toString() ?? '';
                    final name = c['name']?.toString() ?? slug;
                    return ListTile(
                      title: Text(name),
                      onTap: () => Navigator.of(ctx).pop({
                        'category': slug,
                        'minPrice': _parsePrice(minController.text),
                        'maxPrice': _parsePrice(maxController.text),
                      }),
                    );
                  }),
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'Price (NPR)',
                      style: GoogleFonts.poppins(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: minController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Min price',
                              hintText: 'e.g. 100',
                              border: OutlineInputBorder(),
                            ),
                            onChanged: (_) => setModalState(() {}),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: maxController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Max price',
                              hintText: 'e.g. 5000',
                              border: OutlineInputBorder(),
                            ),
                            onChanged: (_) => setModalState(() {}),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    child: FilledButton(
                      onPressed: () {
                        Navigator.of(ctx).pop({
                          'category': _filterCategory,
                          'minPrice': _parsePrice(minController.text),
                          'maxPrice': _parsePrice(maxController.text),
                        });
                      },
                      child: const Text('Apply filters'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
    minController.dispose();
    maxController.dispose();
    if (!mounted) return;
    if (chosen != null) {
      setState(() {
        _filterCategory = chosen['category'] as String?;
        _filterMinPrice = chosen['minPrice'] as double?;
        _filterMaxPrice = chosen['maxPrice'] as double?;
      });
      _loadProductsByCategory(_selectedCategorySlug);
    }
  }

  static double? _parsePrice(String text) {
    final t = text.trim();
    if (t.isEmpty) return null;
    final v = double.tryParse(t);
    return (v != null && v >= 0) ? v : null;
  }

  void _openProductDetail(Map<String, dynamic> product) {
    HapticFeedback.lightImpact();
    final cart = context.read<CartService>();
    final productId = product['_id']?.toString() ?? '';
    final isFavourite = _favouriteIds.contains(productId);
    Navigator.of(context)
        .push<int>(
          PageRouteBuilder<int>(
            opaque: false,
            barrierColor: Colors.black54,
            barrierDismissible: true,
            pageBuilder: (ctx, _, _) => _AddToBasketSheet(
              product: product,
              isFavourite: isFavourite,
              onToggleFavourite: () async {
                try {
                  if (_favouriteIds.contains(productId)) {
                    await _apiClient.removeFavourite(productId);
                    if (mounted) {
                      setState(() => _favouriteIds.remove(productId));
                    }
                  } else {
                    await _apiClient.addFavourite(productId);
                    if (mounted) {
                      setState(() => _favouriteIds.add(productId));
                    }
                  }
                } catch (_) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Could not update favourite'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  }
                }
              },
            ),
            transitionsBuilder: (ctx, animation, secondaryAnimation, child) {
              return SlideTransition(
                position:
                    Tween<Offset>(
                      begin: const Offset(0, 1),
                      end: Offset.zero,
                    ).animate(
                      CurvedAnimation(
                        parent: animation,
                        curve: Curves.easeOutCubic,
                      ),
                    ),
                child: child,
              );
            },
          ),
        )
        .then((qty) {
          if (qty != null && qty > 0) {
            final id = product['_id']?.toString() ?? '';
            final name = product['name']?.toString() ?? 'Product';
            final price = (product['price'] as num?)?.toDouble() ?? 0;
            for (var i = 0; i < qty; i++) {
              cart.addItem(productId: id, name: name, price: price);
            }
          }
          if (mounted && _selectedCategorySlug == kFavouritesSlug) {
            _loadProductsByCategory(kFavouritesSlug);
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
        onApplyPromo: (cartTotal, onApplied, onError, [alreadyAppliedCode]) =>
            _openPromoSheet(cartTotal, onApplied, onError, alreadyAppliedCode),
        onSelectPayment: (finalAmount) => _openPaymentSheet(finalAmount),
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

  void _openPromoSheet(
    double cartTotal,
    void Function(String code, double discountAmount) onApplied,
    void Function(String message) onError, [
    String? alreadyAppliedCode,
  ]) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _PromoSheet(
        cartTotal: cartTotal,
        onApplied: onApplied,
        onError: onError,
        alreadyAppliedCode: alreadyAppliedCode,
      ),
    );
  }

  void _openPaymentSheet(double amount) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _PaymentSheet(
        amount: amount,
        onConfirmed: (methodId) {
          Navigator.of(ctx).pop();
          if (methodId == 'Khalti') {
            _payWithKhalti(ctx, amount);
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Payment method selected.',
                  style: GoogleFonts.poppins(),
                ),
              ),
            );
          }
        },
      ),
    );
  }

  Future<void> _payWithKhalti(BuildContext context, double amount) async {
    final cart = context.read<CartService>();
    if (cart.deliveryAddress == null ||
        cart.deliveryLat == null ||
        cart.deliveryLng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please add a delivery address first.',
            style: GoogleFonts.poppins(),
          ),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }
    if (cart.items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Your cart is empty.', style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    try {
      final orderPayload = {
        'items': cart.items.values
            .map((e) => {'productId': e.productId, 'quantity': e.quantity})
            .toList(),
        'deliveryLocation': {
          'address': cart.deliveryAddress,
          'coordinates': [cart.deliveryLng, cart.deliveryLat],
        },
      };
      final createResp = await _apiClient.createOrder(orderPayload);
      final orderData = createResp.data;
      String? orderId;
      if (orderData is Map) {
        final data = orderData['data'];
        if (data is Map && data['_id'] != null) {
          orderId = data['_id'].toString();
        }
      }
      if (orderId == null || orderId.isEmpty) {
        if (kDebugMode) debugPrint('[Khalti] No orderId in create response');
        throw Exception('Could not create order');
      }

      final initResp = await _apiClient.initiateKhaltiForOrder(orderId);
      final initData = initResp.data;
      String? paymentUrl;
      if (initData is Map) {
        final data = initData['data'];
        if (data is Map && data['paymentUrl'] != null) {
          paymentUrl = data['paymentUrl'].toString();
        }
      }

      if (paymentUrl == null || paymentUrl.isEmpty) {
        throw Exception('Khalti did not return payment URL');
      }

      if (!context.mounted) return;
      final uri = Uri.parse(paymentUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Complete payment in the browser. When done, return to the app. Your order will be updated automatically.',
              style: GoogleFonts.poppins(),
            ),
            duration: const Duration(seconds: 5),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        throw Exception('Could not open payment link');
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[Khalti] Error: $e');
      if (!context.mounted) return;
      String message = 'Payment failed. Please try again.';
      if (e is DioException && e.response?.data != null) {
        final data = e.response!.data;
        if (data is Map && data['message'] != null) {
          message = data['message'].toString();
        }
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message, style: GoogleFonts.poppins()),
          backgroundColor: Colors.red,
        ),
      );
    }
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
                    SliverToBoxAdapter(child: _buildPromoAndSearchHeader()),
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
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      _error!,
                                      style: GoogleFonts.poppins(
                                        color: Colors.red[700],
                                        fontSize: 14,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                    const SizedBox(height: 20),
                                    FilledButton.icon(
                                      onPressed: () {
                                        setState(() => _error = null);
                                        _loadInitial();
                                      },
                                      icon: const Icon(Icons.refresh, size: 20),
                                      label: const Text('Retry'),
                                      style: FilledButton.styleFrom(
                                        backgroundColor: const Color(
                                          AppConstants.primaryColor,
                                        ),
                                      ),
                                    ),
                                    if (_lastErrorWasConnection) ...[
                                      const SizedBox(height: 12),
                                      TextButton.icon(
                                        onPressed: _showSetServerUrlDialog,
                                        icon: const Icon(Icons.settings_ethernet, size: 18),
                                        label: const Text('Set server URL'),
                                        style: TextButton.styleFrom(
                                          foregroundColor: const Color(
                                            AppConstants.primaryColor,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
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
                        : Builder(
                            builder: (context) {
                              const spacing = 8.0;
                              const minSidePadding = 14.0;
                              const maxCardWidth = 148.0;
                              final screenWidth = MediaQuery.sizeOf(
                                context,
                              ).width;
                              final cardWidth =
                                  (screenWidth -
                                          2 * minSidePadding -
                                          2 * spacing)
                                      .clamp(0.0, double.infinity) /
                                  3;
                              final cardWidthClamped = cardWidth.clamp(
                                0.0,
                                maxCardWidth,
                              );
                              const cardHeight = 212.0;
                              final totalWidth =
                                  3 * cardWidthClamped + 2 * spacing;
                              final horizontalPadding =
                                  ((screenWidth - totalWidth) / 2).clamp(
                                    0.0,
                                    double.infinity,
                                  );
                              return SliverPadding(
                                padding: EdgeInsets.fromLTRB(
                                  horizontalPadding,
                                  16,
                                  horizontalPadding,
                                  24,
                                ),
                                sliver: SliverGrid(
                                  gridDelegate:
                                      SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: 3,
                                        mainAxisSpacing: spacing,
                                        crossAxisSpacing: spacing,
                                        childAspectRatio:
                                            cardWidthClamped / cardHeight,
                                      ),
                                  delegate: SliverChildBuilderDelegate((
                                    context,
                                    index,
                                  ) {
                                    final p = _products[index];
                                    return _ProductCard(
                                      product: p,
                                      onTap: () => _openProductDetail(p),
                                      onAddToCart: () => _openProductDetail(p),
                                    );
                                  }, childCount: _products.length),
                                ),
                              );
                            },
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

  void _runSearch() {
    setState(() => _searchQuery = _searchController.text.trim());
    _loadProductsByCategory(_selectedCategorySlug);
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() => _searchQuery = '');
    _loadProductsByCategory(_selectedCategorySlug);
  }

  Widget _buildPromoAndSearchHeader() {
    const primary = Color(AppConstants.primaryColor);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const _ShopPromoBanner(),
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onSubmitted: (_) => _runSearch(),
                  decoration: InputDecoration(
                    hintText: 'Search products',
                    hintStyle: GoogleFonts.poppins(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                    prefixIcon: Icon(
                      Icons.search_rounded,
                      color: primary,
                      size: 22,
                    ),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: Icon(
                              Icons.clear_rounded,
                              size: 20,
                              color: Colors.grey[600],
                            ),
                            onPressed: () {
                              _clearSearch();
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.grey.shade50,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade200),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey.shade200),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: primary, width: 1.5),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                  style: GoogleFonts.poppins(fontSize: 14),
                ),
              ),
              const SizedBox(width: 10),
              _SearchFilterChip(
                icon: Icons.tune_rounded,
                label: (_filterCategory != null ||
                        _filterMinPrice != null ||
                        _filterMaxPrice != null)
                    ? 'Filtered'
                    : 'Filter',
                onTap: () => _showFilterSheet(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildSectionTitle() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
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
            style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[700]),
          ),
        ],
      ),
    );
  }
}

// ─── Promo banner (auto-rotating) ───────────────────────────────────────────

class _ShopPromoBanner extends StatefulWidget {
  const _ShopPromoBanner();

  @override
  State<_ShopPromoBanner> createState() => _ShopPromoBannerState();
}

class _ShopPromoBannerState extends State<_ShopPromoBanner> {
  final PageController _pageController = PageController();
  Timer? _timer;
  int _currentPage = 0;

  static const int _slideCount = 3;
  static const Duration _autoScrollDuration = Duration(seconds: 3);

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(_autoScrollDuration, (_) {
      if (!_pageController.hasClients) return;
      final next = (_currentPage + 1) % _slideCount;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    const accent = Color(AppConstants.accentColor);

    final slides = [
      _PromoSlide(
        gradient: const LinearGradient(
          colors: [primary, accent],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        icon: Icons.local_shipping_rounded,
        title: 'Free delivery',
        subtitle: 'On orders above Rs. ${kFreeDeliveryAbove.toInt()}',
      ),
      _PromoSlide(
        gradient: LinearGradient(
          colors: [const Color(0xFF2D5016), Colors.green.shade700],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        icon: Icons.schedule_rounded,
        title: 'Delivering within a day',
        subtitle: '10:00 AM – 5:00 PM • Rs. ${kDeliveryFee.toInt()} delivery',
      ),
      _PromoSlide(
        gradient: LinearGradient(
          colors: [Colors.orange.shade700, Colors.deepOrange.shade400],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        icon: Icons.pets_rounded,
        title: 'Best for your pet',
        subtitle: 'Quality food & care products',
      ),
    ];

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 132,
          child: PageView.builder(
            controller: _pageController,
            onPageChanged: (i) => setState(() => _currentPage = i),
            itemCount: _slideCount,
            itemBuilder: (context, index) {
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: slides[index],
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            _slideCount,
            (i) => AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: _currentPage == i ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: _currentPage == i ? primary : Colors.grey.shade300,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PromoSlide extends StatelessWidget {
  final Gradient gradient;
  final IconData icon;
  final String title;
  final String subtitle;

  const _PromoSlide({
    required this.gradient,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: Colors.white, size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.poppins(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.95),
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Search / Filter chip ───────────────────────────────────────────────────

class _SearchFilterChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _SearchFilterChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    return Material(
      color: Colors.grey.shade50,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20, color: primary),
              const SizedBox(width: 10),
              Flexible(
                child: Text(
                  label,
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade700,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
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
    final screenWidth = MediaQuery.sizeOf(context).width;
    final allCat = <Map<String, dynamic>>[
      {'slug': '', 'name': 'All'},
      {'slug': kFavouritesSlug, 'name': 'Favourites'},
      ...categories,
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : screenWidth;
        return SizedBox(
          height: 100,
          width: width,
          child: ClipRect(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              scrollDirection: Axis.horizontal,
              itemCount: allCat.length,
              separatorBuilder: (context, index) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final c = allCat[index];
                final slug = c['slug']?.toString() ?? '';
                final name = c['name']?.toString() ?? slug;
                final isActive = slug == selectedSlug;
                final categoryImage = c['image']?.toString();
                final imageUrl = slug.isEmpty
                    ? null
                    : (categoryImage != null && categoryImage.isNotEmpty
                          ? categoryImage
                          : _firstImageForCategory(slug));
                return GestureDetector(
                  onTap: () => onChanged(slug),
                  child: SizedBox(
                    width: 70,
                    height: 100,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 56,
                          height: 56,
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
                                    width: 56,
                                    height: 56,
                                    placeholder: (context, url) => Container(
                                      color: const Color(0xFFF5F0EB),
                                      child: Icon(
                                        Icons.pets,
                                        size: 26,
                                        color: primary,
                                      ),
                                    ),
                                    errorWidget: (context, error, stackTrace) =>
                                        Container(
                                          color: const Color(0xFFF5F0EB),
                                          child: Icon(
                                            Icons.pets,
                                            size: 26,
                                            color: primary,
                                          ),
                                        ),
                                  )
                                : Container(
                                    color: const Color(0xFFF5F0EB),
                                    child: Icon(
                                      slug == kFavouritesSlug
                                          ? Icons.favorite_border
                                          : slug.isEmpty
                                          ? Icons.grid_view
                                          : Icons.pets,
                                      size: 26,
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
                            fontWeight: isActive
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: isActive ? Colors.black87 : Colors.grey[700],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        );
      },
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
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.max,
        children: [
          // Image area: light background, inner padding for frame
          SizedBox(
            height: 115,
            width: double.infinity,
            child: GestureDetector(
              onTap: onTap,
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: Color(0xFFF5F0EB),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: imageUrl != null
                      ? CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.contain,
                          width: double.infinity,
                          height: double.infinity,
                          placeholder: (context, url) => Center(
                            child: Icon(Icons.pets, size: 24, color: primary),
                          ),
                          errorWidget: (context, error, stackTrace) => Center(
                            child: Icon(Icons.pets, size: 40, color: primary),
                          ),
                        )
                      : Center(
                          child: Icon(Icons.pets, size: 24, color: primary),
                        ),
                ),
              ),
            ),
          ),
          // Text block: consistent padding, clear gap between description and price
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.poppins(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                  if (desc.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      desc,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.poppins(
                        fontSize: 8,
                        fontWeight: FontWeight.w400,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Rs. ${price.toStringAsFixed(0)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w700,
                            fontSize: 10,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: onAddToCart,
                        child: Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            color: primary,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: primary.withValues(alpha: 0.3),
                                blurRadius: 3,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.add,
                            size: 14,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
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
            Flexible(
              child: Text(
                '$totalItems item${totalItems == 1 ? '' : 's'}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.poppins(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
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
            Flexible(
              child: Text(
                'Rs. ${subtotal.toStringAsFixed(2)}/-',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.poppins(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
            const Spacer(),
            Text(
              'View basket',
              style: GoogleFonts.poppins(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 14,
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
  final bool isFavourite;
  final VoidCallback onToggleFavourite;

  const _AddToBasketSheet({
    required this.product,
    required this.isFavourite,
    required this.onToggleFavourite,
  });

  @override
  State<_AddToBasketSheet> createState() => _AddToBasketSheetState();
}

class _AddToBasketSheetState extends State<_AddToBasketSheet> {
  int _qty = 1;
  late bool _isFavourite;

  @override
  void initState() {
    super.initState();
    _isFavourite = widget.isFavourite;
  }

  @override
  void didUpdateWidget(covariant _AddToBasketSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isFavourite != widget.isFavourite) {
      _isFavourite = widget.isFavourite;
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
    final product = widget.product;
    final images = product['images'] as List<dynamic>? ?? [];
    final imageUrl = images.isNotEmpty ? images.first.toString() : null;
    final name = product['name']?.toString() ?? 'Product';
    final desc = product['description']?.toString() ?? '';
    final price = (product['price'] as num?)?.toDouble() ?? 0;

    final size = MediaQuery.sizeOf(context);
    final maxSheetHeight = size.height * 0.75;
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).pop(),
              child: Container(color: Colors.black54),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: maxSheetHeight,
            child: SafeArea(
              top: false,
              child: SizedBox(
                width: size.width,
                height: maxSheetHeight,
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(24),
                    ),
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
                            GestureDetector(
                              onTap: () => Navigator.of(context).pop(),
                              behavior: HitTestBehavior.opaque,
                              child: const Padding(
                                padding: EdgeInsets.all(8),
                                child: Icon(Icons.close_rounded),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: ListView(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
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
                                        placeholder: (context, url) => Center(
                                          child: Icon(
                                            Icons.pets,
                                            color: primary,
                                          ),
                                        ),
                                        errorWidget:
                                            (context, error, stackTrace) =>
                                                Center(
                                                  child: Icon(
                                                    Icons.pets,
                                                    color: primary,
                                                  ),
                                                ),
                                      ),
                                    )
                                  : Center(
                                      child: Icon(
                                        Icons.pets,
                                        size: 80,
                                        color: primary,
                                      ),
                                    ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.poppins(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                            if (desc.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                desc.length > 50
                                    ? '${desc.substring(0, 50)}...'
                                    : desc,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                            ],
                            const SizedBox(height: 10),
                            Text(
                              'Rs. ${price.toStringAsFixed(0)}',
                              style: GoogleFonts.poppins(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 18),
                            Row(
                              children: [
                                Text(
                                  'Quantity',
                                  style: GoogleFonts.poppins(
                                    fontWeight: FontWeight.w500,
                                    fontSize: 12,
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
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          16,
                          16,
                          16,
                          16 + bottomInset,
                        ),
                        child: SizedBox(
                          height: 56,
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Expanded(
                                child: GestureDetector(
                                  onTap: () {
                                    HapticFeedback.lightImpact();
                                    Navigator.of(context).pop(_qty);
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 13,
                                    ),
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
                                    child: FittedBox(
                                      fit: BoxFit.scaleDown,
                                      child: Text(
                                        'Add to basket • Rs. ${(price * _qty).toStringAsFixed(0)}',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: GoogleFonts.poppins(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 16,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              GestureDetector(
                              onTap: () {
                                HapticFeedback.lightImpact();
                                widget.onToggleFavourite();
                                setState(() => _isFavourite = !_isFavourite);
                              },
                              behavior: HitTestBehavior.opaque,
                              child: Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                alignment: Alignment.center,
                                child: Icon(
                                  _isFavourite
                                      ? Icons.favorite
                                      : Icons.favorite_border,
                                  color: _isFavourite
                                      ? Colors.red
                                      : Colors.grey.shade600,
                                  size: 26,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
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
                fontSize: 10,
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
  final void Function(
    double cartTotal,
    void Function(String code, double discountAmount) onApplied,
    void Function(String message) onError, [
    String? alreadyAppliedCode,
  ])
  onApplyPromo;
  final void Function(double finalAmount) onSelectPayment;

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
  String? _appliedPromoCode;
  double _discountAmount = 0;

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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
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
                            Icon(
                              Icons.add_location_alt_outlined,
                              color: primary,
                            ),
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
                            Icon(
                              Icons.chevron_right_rounded,
                              color: Colors.black45,
                            ),
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
                                  item.productId,
                                  item.quantity - 1,
                                );
                              },
                              onPlus: () {
                                cart.updateQuantity(
                                  item.productId,
                                  item.quantity + 1,
                                );
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
                      onTap: () {
                        widget.onApplyPromo(
                          widget.grandTotal,
                          (code, discountAmount) {
                            setState(() {
                              _appliedPromoCode = code;
                              _discountAmount = discountAmount;
                            });
                          },
                          (message) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  message,
                                  style: GoogleFonts.poppins(
                                    color: Colors.white,
                                  ),
                                ),
                                backgroundColor: Colors.red[700],
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          },
                          _appliedPromoCode,
                        );
                      },
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
                                _appliedPromoCode != null
                                    ? '$_appliedPromoCode • Rs. ${_discountAmount.toStringAsFixed(0)} off'
                                    : 'Apply promo code',
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            Icon(
                              Icons.chevron_right_rounded,
                              color: Colors.black45,
                            ),
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
                    if (_discountAmount > 0) ...[
                      const SizedBox(height: 4),
                      _billRow('Promo discount', -_discountAmount),
                    ],
                    const SizedBox(height: 6),
                    const Divider(height: 1, color: Color(0xFFE3E0DD)),
                    const SizedBox(height: 6),
                    _billRow(
                      'Grand total',
                      widget.grandTotal - _discountAmount,
                      isEmphasis: true,
                    ),
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
                      onTap: () => widget.onSelectPayment(
                        widget.grandTotal - _discountAmount,
                      ),
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
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            Icon(
                              Icons.chevron_right_rounded,
                              color: Colors.black45,
                            ),
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
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.poppins(
              fontSize: 13,
              fontWeight: isEmphasis ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          amount < 0
              ? '- Rs. ${(-amount).toStringAsFixed(0)}'
              : 'Rs. ${amount.toStringAsFixed(0)}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
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

class _PlaceSuggestion {
  final String displayName;
  final double lat;
  final double lon;
  _PlaceSuggestion({
    required this.displayName,
    required this.lat,
    required this.lon,
  });
}

class _AddAddressSheetState extends State<_AddAddressSheet> {
  final _addressTitleController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _locationSearchController = TextEditingController();
  final FocusNode _locationSearchFocus = FocusNode();
  LatLng _pin = const LatLng(27.7172, 85.3240);
  String? _address;
  bool _loadingAddress = false;
  final MapController _mapController = MapController();
  List<_PlaceSuggestion> _locationSuggestions = [];
  bool _locationSearching = false;
  late final Dio _nominatimDio;

  @override
  void initState() {
    super.initState();
    _nominatimDio = Dio(
      BaseOptions(
        baseUrl: 'https://nominatim.openstreetmap.org',
        headers: const {'User-Agent': 'PawSewa Mobile App (pawsewa.app)'},
      ),
    );
  }

  @override
  void dispose() {
    _addressTitleController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _locationSearchController.dispose();
    _locationSearchFocus.dispose();
    super.dispose();
  }

  Future<void> _searchLocation(String query) async {
    final q = query.trim();
    if (q.isEmpty) {
      setState(() => _locationSuggestions = []);
      return;
    }
    setState(() => _locationSearching = true);
    try {
      final resp = await _nominatimDio.get<List>(
        '/search',
        queryParameters: {'q': q, 'format': 'json', 'limit': 5},
      );
      final list = resp.data;
      if (!mounted) return;
      if (list == null || list.isEmpty) {
        setState(() {
          _locationSuggestions = [];
          _locationSearching = false;
        });
        return;
      }
      final results = <_PlaceSuggestion>[];
      for (final e in list) {
        if (e is! Map) continue;
        final lat = double.tryParse(e['lat']?.toString() ?? '');
        final lon = double.tryParse(e['lon']?.toString() ?? '');
        final name = e['display_name']?.toString() ?? '';
        if (lat != null && lon != null && name.isNotEmpty) {
          results.add(_PlaceSuggestion(displayName: name, lat: lat, lon: lon));
        }
      }
      setState(() {
        _locationSuggestions = results;
        _locationSearching = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _locationSuggestions = [];
          _locationSearching = false;
        });
      }
    }
  }

  void _onSelectLocationSuggestion(_PlaceSuggestion place) {
    _locationSearchFocus.unfocus();
    setState(() {
      _pin = LatLng(place.lat, place.lon);
      _address = place.displayName;
      _locationSuggestions = [];
      _locationSearchController.clear();
    });
    _mapController.move(LatLng(place.lat, place.lon), 16);
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
          headers: const {'User-Agent': 'PawSewa Mobile App (pawsewa.app)'},
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
    final result = await Navigator.of(
      context,
    ).push<bool>(MaterialPageRoute(builder: (_) => const DeliveryPinScreen()));
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
      SnackBar(content: Text('Address saved.', style: GoogleFonts.poppins())),
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
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  children: [
                    TextField(
                      controller: _locationSearchController,
                      focusNode: _locationSearchFocus,
                      decoration: InputDecoration(
                        hintText: 'Search e.g. Putalisadak, Kathmandu',
                        hintStyle: GoogleFonts.poppins(color: Colors.grey),
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: _locationSearching
                            ? const Padding(
                                padding: EdgeInsets.all(12),
                                child: SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              )
                            : null,
                        filled: true,
                        fillColor: Colors.grey.shade100,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                      ),
                      style: GoogleFonts.poppins(),
                      onChanged: (value) {
                        if (value.trim().isEmpty) {
                          setState(() => _locationSuggestions = []);
                          return;
                        }
                        Future.delayed(const Duration(milliseconds: 400), () {
                          if (mounted &&
                              _locationSearchController.text.trim() ==
                                  value.trim()) {
                            _searchLocation(value);
                          }
                        });
                      },
                    ),
                    if (_locationSuggestions.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        constraints: const BoxConstraints(maxHeight: 160),
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: _locationSuggestions.length,
                          itemBuilder: (context, index) {
                            final place = _locationSuggestions[index];
                            return ListTile(
                              leading: Icon(
                                Icons.place,
                                color: primary,
                                size: 22,
                              ),
                              title: Text(
                                place.displayName,
                                style: GoogleFonts.poppins(fontSize: 12),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              onTap: () => _onSelectLocationSuggestion(place),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
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
                                  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                              subdomains: const ['a', 'b', 'c', 'd'],
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
}

// ─── Promo sheet ────────────────────────────────────────────────────────────

class _PromoSheet extends StatefulWidget {
  final double cartTotal;
  final void Function(String code, double discountAmount) onApplied;
  final void Function(String message) onError;
  final String? alreadyAppliedCode;

  const _PromoSheet({
    required this.cartTotal,
    required this.onApplied,
    required this.onError,
    this.alreadyAppliedCode,
  });

  @override
  State<_PromoSheet> createState() => _PromoSheetState();
}

class _PromoSheetState extends State<_PromoSheet> {
  final _controller = TextEditingController();
  bool _loading = false;
  String? _successMessage;
  String? _errorMessage;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _apply() async {
    final code = _controller.text.trim();
    if (code.isEmpty) {
      widget.onError('Enter a code to apply.');
      return;
    }
    setState(() {
      _loading = true;
      _errorMessage = null;
      _successMessage = null;
    });
    try {
      final apiClient = ApiClient();
      final resp = await apiClient.validatePromoCode(
        code: code,
        currentOrderAmount: widget.cartTotal,
        alreadyAppliedCode: widget.alreadyAppliedCode,
      );
      if (!mounted) return;
      final data = resp.data;
      if (data is Map && data['success'] == true && data['data'] is Map) {
        final d = data['data'] as Map;
        final discountAmount = (d['discountAmount'] as num?)?.toDouble() ?? 0;
        final appliedCode = (d['code'] as String?) ?? code.toUpperCase();
        setState(() {
          _loading = false;
          _successMessage =
              'Success! Rs. ${discountAmount.toStringAsFixed(0)} saved';
        });
        widget.onApplied(appliedCode, discountAmount);
        Navigator.of(context).pop();
      } else {
        setState(() {
          _loading = false;
          _errorMessage = 'Invalid response.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      final msg = e is DioException && e.response?.data is Map
          ? (e.response!.data as Map)['message']?.toString() ??
                'Could not apply code.'
          : 'Could not apply code.';
      setState(() {
        _loading = false;
        _errorMessage = msg;
      });
      widget.onError(msg);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(AppConstants.primaryColor);
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
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      behavior: HitTestBehavior.opaque,
                      child: const Padding(
                        padding: EdgeInsets.all(8),
                        child: Icon(Icons.close_rounded),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _controller,
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
                            textCapitalization: TextCapitalization.characters,
                            onChanged: (_) {
                              if (_errorMessage != null ||
                                  _successMessage != null) {
                                setState(() {
                                  _errorMessage = null;
                                  _successMessage = null;
                                });
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: _loading ? null : _apply,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primary,
                            foregroundColor: Colors.white,
                          ),
                          child: _loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text('APPLY'),
                        ),
                      ],
                    ),
                    if (_successMessage != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.green.shade50,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.check_circle,
                              color: Colors.green[700],
                              size: 22,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _successMessage!,
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.green[800],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (_errorMessage != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.error_outline,
                              color: Colors.red[700],
                              size: 22,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: GoogleFonts.poppins(
                                  fontSize: 13,
                                  color: Colors.red[800],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    Center(
                      child: Text(
                        'Cart total: Rs. ${widget.cartTotal.toStringAsFixed(0)}',
                        style: GoogleFonts.poppins(
                          fontSize: 12,
                          color: Colors.grey[600],
                        ),
                      ),
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
  final void Function(String methodId) onConfirmed;

  const _PaymentSheet({required this.amount, required this.onConfirmed});

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
                    Expanded(
                      child: Text(
                        'Payment Method',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w700,
                          fontSize: 18,
                          color: Colors.black87,
                        ),
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
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
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
                                    fontWeight: isSelected
                                        ? FontWeight.w600
                                        : FontWeight.w500,
                                    color: isSelected
                                        ? primary
                                        : Colors.black87,
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
                            crossAxisSpacing: 8,
                            mainAxisSpacing: 8,
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
                                    fontWeight: isSelected
                                        ? FontWeight.w600
                                        : FontWeight.w500,
                                    color: isSelected
                                        ? primary
                                        : Colors.black87,
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
                          Flexible(
                            child: Text(
                              'Rs. ${widget.amount.toStringAsFixed(0)}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.poppins(
                                fontWeight: FontWeight.w700,
                                fontSize: 18,
                                color: Colors.black87,
                              ),
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
                          onPressed: () => widget.onConfirmed(_selected),
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
