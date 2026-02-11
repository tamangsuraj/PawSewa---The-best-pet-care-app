import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../cart/cart_service.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  final _apiClient = ApiClient();
  final _searchController = TextEditingController();

  List<dynamic> _products = [];
  List<dynamic> _categories = [];
  String _selectedCategory = '';
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
      setState(() {
        _categories = respCats.data['data'] ?? [];
        _products = respProds.data['data'] ?? [];
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

  Future<void> _search() async {
    try {
      setState(() {
        _loading = true;
        _error = null;
      });
      final resp = await _apiClient.getProducts(
        search: _searchController.text.trim(),
        category: _selectedCategory.isEmpty ? null : _selectedCategory,
      );
      if (!mounted) return;
      setState(() {
        _products = resp.data['data'] ?? [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to search products: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = const Color(AppConstants.primaryColor);

    return SafeArea(
      child: Scaffold(
        backgroundColor: const Color(AppConstants.bentoBackgroundColor),
        appBar: AppBar(
          title: Text(
            'Shop',
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
          backgroundColor: primary,
          elevation: 0,
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search products…',
                  prefixIcon: const Icon(Icons.search),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(24),
                    borderSide: BorderSide.none,
                  ),
                ),
                onSubmitted: (_) => _search(),
              ),
            ),
            _buildCategoryChips(),
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: Color(AppConstants.primaryColor),
                      ),
                    )
                  : _error != null
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              _error!,
                              style: GoogleFonts.poppins(color: Colors.red),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        )
                      : _products.isEmpty
                          ? Center(
                              child: Text(
                                'No products found.',
                                style: GoogleFonts.poppins(color: Colors.grey[600]),
                              ),
                            )
                          : Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              child: GridView.builder(
                                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  childAspectRatio: 0.72,
                                  crossAxisSpacing: 8,
                                  mainAxisSpacing: 8,
                                ),
                                itemCount: _products.length,
                                itemBuilder: (context, index) {
                                  final p = _products[index] as Map<String, dynamic>;
                                  return _buildProductCard(p, primary);
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    final chips = <Widget>[
      ChoiceChip(
        label: Text('All', style: GoogleFonts.poppins()),
        selected: _selectedCategory.isEmpty,
        onSelected: (_) {
          setState(() => _selectedCategory = '');
          _search();
        },
      ),
      ..._categories.map((c) {
        final map = c as Map<String, dynamic>;
        final slug = map['slug']?.toString() ?? '';
        final name = map['name']?.toString() ?? slug;
        final selected = _selectedCategory == slug;
        return Padding(
          padding: const EdgeInsets.only(left: 8),
          child: ChoiceChip(
            label: Text(name, style: GoogleFonts.poppins()),
            selected: selected,
            onSelected: (_) {
              setState(() => _selectedCategory = slug);
              _search();
            },
          ),
        );
      }),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: Row(children: chips),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> p, Color primary) {
    final images = p['images'] as List<dynamic>? ?? [];
    final imageUrl = images.isNotEmpty ? images.first.toString() : null;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              child: imageUrl == null
                  ? Container(
                      color: primary.withValues(alpha: 0.06),
                      child: const Center(
                        child: Icon(Icons.pets, size: 32, color: Colors.grey),
                      ),
                    )
                  : CachedNetworkImage(
                      imageUrl: imageUrl,
                      fit: BoxFit.cover,
                      width: double.infinity,
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p['name']?.toString() ?? 'Product',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'NPR ${(p['price'] as num?)?.toStringAsFixed(0) ?? '-'}',
                  style: GoogleFonts.poppins(
                    fontSize: 13,
                    color: primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: IconButton(
                    icon: const Icon(Icons.add_shopping_cart),
                    color: primary,
                    onPressed: () {
                      final id = p['_id']?.toString() ?? '';
                      final name = p['name']?.toString() ?? 'Product';
                      final price = (p['price'] as num?)?.toDouble() ?? 0;
                      context
                          .read<CartService>()
                          .addItem(productId: id, name: name, price: price);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Added to cart', style: GoogleFonts.poppins()),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
