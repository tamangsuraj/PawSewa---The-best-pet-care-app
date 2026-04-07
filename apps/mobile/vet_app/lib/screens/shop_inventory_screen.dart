import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:pawsewa_partner/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../services/socket_service.dart';
import '../widgets/editorial_canvas.dart';
import 'order_proof_view_screen.dart';

class ShopInventoryScreen extends StatefulWidget {
  const ShopInventoryScreen({super.key});

  @override
  State<ShopInventoryScreen> createState() => _ShopInventoryScreenState();
}

class _ShopInventoryScreenState extends State<ShopInventoryScreen> {
  final _apiClient = ApiClient();

  bool _loading = true;
  String? _error;
  List<dynamic> _products = [];
  List<dynamic> _categories = [];

  final _nameController = TextEditingController();
  final _priceController = TextEditingController();
  final _stockController = TextEditingController();
  final _descriptionController = TextEditingController();
  String? _selectedCategoryId;
  bool _isAvailable = true;
  bool _saving = false;
  final ImagePicker _picker = ImagePicker();
  List<XFile> _selectedImages = [];

  List<Map<String, dynamic>> _assignedShopOrders = [];
  bool _loadingShopOrders = false;

  // Add category
  final _categoryNameController = TextEditingController();
  XFile? _categoryImage;
  bool _creatingCategory = false;

  void _onShopOrderSocket(String event, Map<String, dynamic> payload) {
    if (event != 'order:assigned_seller' && event != 'orderUpdate') return;
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('New order assigned to your shop')),
    );
    _loadAssignedShopOrders();
  }

  @override
  void initState() {
    super.initState();
    _loadData();
    _loadAssignedShopOrders();
    SocketService.instance.connect();
    SocketService.instance.addShopOrderListener(_onShopOrderSocket);
  }

  @override
  void dispose() {
    SocketService.instance.removeShopOrderListener(_onShopOrderSocket);
    _nameController.dispose();
    _priceController.dispose();
    _stockController.dispose();
    _descriptionController.dispose();
    _categoryNameController.dispose();
    super.dispose();
  }

  Future<void> _loadAssignedShopOrders() async {
    setState(() => _loadingShopOrders = true);
    try {
      final r = await _apiClient.getSellerAssignedOrders();
      final body = r.data;
      if (body is Map && body['success'] == true && body['data'] is List) {
        if (mounted) {
          setState(() {
            _assignedShopOrders = (body['data'] as List)
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
          });
        }
      }
    } catch (_) {
      if (mounted) setState(() => _assignedShopOrders = []);
    } finally {
      if (mounted) setState(() => _loadingShopOrders = false);
    }
  }

  Future<void> _confirmShopOrder(String orderId) async {
    try {
      await _apiClient.confirmSellerOrderStock(orderId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Stock confirmed — ready for rider assignment'),
        ),
      );
      await _loadAssignedShopOrders();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }

  Future<void> _markPacked(String orderId) async {
    try {
      await _apiClient.sellerMarkPacked(orderId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Marked packed — rider can dispatch')),
      );
      await _loadAssignedShopOrders();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is DioException && e.response?.data is Map
                ? (e.response!.data as Map)['message']?.toString() ?? '$e'
                : '$e',
          ),
        ),
      );
    }
  }

  Future<void> _promptTracking(String orderId) async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Tracking / reference', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            labelText: 'Tracking number (optional)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok != true) {
      ctrl.dispose();
      return;
    }
    if (!mounted) {
      ctrl.dispose();
      return;
    }
    try {
      await _apiClient.sellerSetOrderTracking(orderId, ctrl.text.trim());
      ctrl.dispose();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tracking saved')));
      await _loadAssignedShopOrders();
    } catch (e) {
      ctrl.dispose();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _shareInvoice(String orderId) async {
    try {
      final r = await _apiClient.getOrderInvoice(orderId);
      final body = r.data;
      if (body is Map && body['data'] != null) {
        final text = const JsonEncoder.withIndent('  ').convert(body['data']);
        await Share.share(text, subject: 'PawSewa order invoice');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Invoice failed: $e')));
    }
  }

  Future<void> _createCategory() async {
    final name = _categoryNameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Enter category name')));
      return;
    }
    setState(() => _creatingCategory = true);
    try {
      final formData = FormData();
      formData.fields.add(MapEntry('name', name));
      if (_categoryImage != null) {
        final f = _categoryImage!;
        final filename = f.name.trim().isNotEmpty && f.name.contains('.')
            ? f.name
            : 'category.jpg';
        formData.files.add(
          MapEntry(
            'image',
            await MultipartFile.fromFile(f.path, filename: filename),
          ),
        );
      }
      await _apiClient.createCategoryForm(formData);
      if (!mounted) return;
      _categoryNameController.clear();
      setState(() => _categoryImage = null);
      await _loadData();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Category created')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed to create category: $e')));
    } finally {
      if (mounted) setState(() => _creatingCategory = false);
    }
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final productsResp = await _apiClient.getProducts();
      final categoriesResp = await _apiClient.getCategories();
      if (!mounted) return;
      setState(() {
        _products = productsResp.data['data'] ?? [];
        _categories = categoriesResp.data['data'] ?? [];
        if (_categories.isNotEmpty) {
          _selectedCategoryId = _categories.first['_id']?.toString();
        }
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      if (kDebugMode) {
        debugPrint('Error loading inventory: $e');
      }
      setState(() {
        _error = 'Failed to load inventory. Please try again.';
        _loading = false;
      });
    }
  }

  Future<void> _submitProduct() async {
    if (_selectedCategoryId == null ||
        _nameController.text.trim().isEmpty ||
        _priceController.text.trim().isEmpty ||
        _stockController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all required fields.')),
      );
      return;
    }
    setState(() {
      _saving = true;
    });
    try {
      final formData = FormData();
      formData.fields.addAll([
        MapEntry('name', _nameController.text.trim()),
        MapEntry('price', _priceController.text.trim()),
        MapEntry('stockQuantity', _stockController.text.trim()),
        MapEntry('category', _selectedCategoryId!),
        MapEntry('description', _descriptionController.text.trim()),
        MapEntry('isAvailable', _isAvailable ? 'true' : 'false'),
      ]);

      for (final image in _selectedImages) {
        // Ensure filename has an extension so backend can infer MIME (mobile often sends application/octet-stream)
        final name = image.name.trim().isNotEmpty ? image.name : 'image';
        final filename = name.contains('.') ? name : '$name.jpg';
        formData.files.add(
          MapEntry(
            'images',
            await MultipartFile.fromFile(image.path, filename: filename),
          ),
        );
      }

      await _apiClient.createProductForm(formData);
      if (!mounted) return;
      _nameController.clear();
      _priceController.clear();
      _stockController.clear();
      _descriptionController.clear();
      _isAvailable = true;
      _selectedImages = [];
      await _loadData();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Product created successfully')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed to create product: $e')));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  Future<void> _updateStock(String productId, String newStock) async {
    try {
      await _apiClient.updateProductStock(
        productId: productId,
        stockQuantity: newStock,
      );
      await _loadData();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Stock updated')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed to update stock: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = const Color(AppConstants.primaryColor);

    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        title: Text(
          'Shop Inventory',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
        ),
        backgroundColor: primary,
        foregroundColor: Colors.white,
      ),
      backgroundColor: Colors.transparent,
      body: Stack(
        clipBehavior: Clip.none,
        children: [
          const EditorialBodyBackdrop(),
          Positioned.fill(
            child: _loading
                ? const Center(
                    child: PawSewaLoader(),
                  )
                : RefreshIndicator(
                    color: primary,
                    onRefresh: () async {
                      await _loadData();
                      await _loadAssignedShopOrders();
                    },
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        return ListView(
                          padding: EdgeInsets.all(
                            (constraints.maxWidth * 0.04).clamp(12.0, 20.0),
                          ),
                          children: [
                            if (_loadingShopOrders &&
                                _assignedShopOrders.isEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: LinearProgressIndicator(
                                  color: primary,
                                  backgroundColor: primary.withValues(
                                    alpha: 0.15,
                                  ),
                                ),
                              ),
                            if (_assignedShopOrders.isNotEmpty) ...[
                              Text(
                                'Orders assigned to your shop',
                                style: GoogleFonts.outfit(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 8),
                              ..._assignedShopOrders.map((o) {
                                final id = o['_id']?.toString() ?? '';
                                final user = o['user'];
                                final name = user is Map
                                    ? (user['name']?.toString() ?? 'Customer')
                                    : 'Customer';
                                final addr = o['deliveryLocation'] is Map
                                    ? (o['deliveryLocation']['address']
                                              ?.toString() ??
                                          '')
                                    : '';
                                final confirmed =
                                    o['sellerConfirmedAt'] != null;
                                final status = o['status']?.toString() ?? '';
                                final hasProof = o['proofOfDelivery'] is Map &&
                                    ((o['proofOfDelivery'] as Map)['otp']?.toString().trim().isNotEmpty == true ||
                                        (o['proofOfDelivery'] as Map)['photoUrl']?.toString().trim().isNotEmpty == true ||
                                        (o['proofOfDelivery'] as Map)['notes']?.toString().trim().isNotEmpty == true);
                                return Card(
                                  margin: const EdgeInsets.only(bottom: 8),
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Order …${id.length > 6 ? id.substring(id.length - 6) : id}',
                                          style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        Text(
                                          name,
                                          style: GoogleFonts.outfit(
                                            fontSize: 13,
                                            color: Colors.grey[700],
                                          ),
                                        ),
                                        if (status.isNotEmpty)
                                          Text(
                                            'Status: $status',
                                            style: GoogleFonts.outfit(
                                              fontSize: 12,
                                              color: Colors.grey[700],
                                            ),
                                          ),
                                        if (addr.isNotEmpty)
                                          Text(
                                            addr,
                                            maxLines: 3,
                                            softWrap: true,
                                            overflow: TextOverflow.ellipsis,
                                            style: GoogleFonts.outfit(
                                              fontSize: 12,
                                            ),
                                          ),
                                        const SizedBox(height: 8),
                                        if (confirmed)
                                          Text(
                                            'Stock confirmed',
                                            style: GoogleFonts.outfit(
                                              color: Colors.green[700],
                                              fontWeight: FontWeight.w500,
                                            ),
                                          )
                                        else
                                          ElevatedButton(
                                            onPressed: id.isEmpty
                                                ? null
                                                : () => _confirmShopOrder(id),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: primary,
                                              foregroundColor: Colors.white,
                                            ),
                                            child: Text(
                                              'Confirm stock',
                                              style: GoogleFonts.outfit(),
                                            ),
                                          ),
                                        if (id.isNotEmpty) ...[
                                          const SizedBox(height: 8),
                                          Wrap(
                                            spacing: 8,
                                            runSpacing: 8,
                                            children: [
                                              if (status == 'processing' && confirmed)
                                                ElevatedButton(
                                                  onPressed: () => _markPacked(id),
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: Colors.teal.shade700,
                                                    foregroundColor: Colors.white,
                                                  ),
                                                  child: Text(
                                                    'Mark packed',
                                                    style: GoogleFonts.outfit(),
                                                  ),
                                                ),
                                              TextButton(
                                                onPressed: () => _promptTracking(id),
                                                child: Text(
                                                  'Tracking',
                                                  style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                                                ),
                                              ),
                                              TextButton(
                                                onPressed: () => _shareInvoice(id),
                                                child: Text(
                                                  'Invoice',
                                                  style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                        if (status == 'ready_for_pickup' || status == 'packed')
                                          Padding(
                                            padding: const EdgeInsets.only(top: 6),
                                            child: Text(
                                              status == 'ready_for_pickup'
                                                  ? 'Ready — admin will assign a rider'
                                                  : 'Packed — waiting for rider pickup',
                                              style: GoogleFonts.outfit(
                                                fontSize: 12,
                                                color: Colors.teal.shade800,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        if (status == 'delivered' && hasProof) ...[
                                          const SizedBox(height: 10),
                                          OutlinedButton.icon(
                                            onPressed: () {
                                              Navigator.of(context).push(
                                                MaterialPageRoute(
                                                  builder: (_) => OrderProofViewScreen(
                                                    order: Map<String, dynamic>.from(o),
                                                  ),
                                                ),
                                              );
                                            },
                                            icon: const Icon(Icons.receipt_long_rounded),
                                            label: Text(
                                              'View delivery proof',
                                              style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                );
                              }),
                              const SizedBox(height: 20),
                            ],
                            if (_error != null)
                              Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.red[50],
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  _error!,
                                  style: GoogleFonts.outfit(
                                    color: Colors.red[700],
                                  ),
                                ),
                              ),
                            Text(
                              'Add New Product',
                              style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 8),
                            _buildCategorySection(primary),
                            const SizedBox(height: 16),
                            _buildTextField(
                              controller: _nameController,
                              label: 'Name *',
                              hint: 'Product name',
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Images (optional)',
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Flexible(
                                  child: ElevatedButton(
                                    onPressed: () async {
                                      final images = await _picker
                                          .pickMultiImage(imageQuality: 85);
                                      if (images.isNotEmpty) {
                                        setState(() {
                                          _selectedImages = images;
                                        });
                                      }
                                    },
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: primary,
                                      foregroundColor: Colors.white,
                                    ),
                                    child: Text(
                                      'Choose Images',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                ),
                                SizedBox(
                                  width: (constraints.maxWidth * 0.03).clamp(
                                    8.0,
                                    14.0,
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    _selectedImages.isEmpty
                                        ? 'No images selected'
                                        : '${_selectedImages.length} image(s) selected',
                                    maxLines: 2,
                                    softWrap: true,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      color: Colors.grey[700],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildTextField(
                                    controller: _priceController,
                                    label: 'Price (NPR) *',
                                    hint: 'e.g. 1000',
                                    keyboardType: TextInputType.number,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildTextField(
                                    controller: _stockController,
                                    label: 'Stock *',
                                    hint: 'e.g. 5',
                                    keyboardType: TextInputType.number,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            DropdownButtonFormField<String>(
                              initialValue: _selectedCategoryId,
                              items: _categories
                                  .map(
                                    (c) => DropdownMenuItem<String>(
                                      value: c['_id']?.toString(),
                                      child: Text(
                                        c['name']?.toString() ?? 'Category',
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (value) {
                                setState(() {
                                  _selectedCategoryId = value;
                                });
                              },
                              decoration: InputDecoration(
                                labelText: 'Category *',
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            _buildTextField(
                              controller: _descriptionController,
                              label: 'Description',
                              hint: 'Short description (optional)',
                              maxLines: 3,
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Switch(
                                  value: _isAvailable,
                                  thumbColor:
                                      WidgetStateProperty.resolveWith<Color?>(
                                        (states) =>
                                            states.contains(
                                              WidgetState.selected,
                                            )
                                            ? primary
                                            : null,
                                      ),
                                  onChanged: (v) {
                                    setState(() {
                                      _isAvailable = v;
                                    });
                                  },
                                ),
                                Text(
                                  'Active / visible in apps',
                                  style: GoogleFonts.outfit(fontSize: 13),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: _saving ? null : _submitProduct,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: primary,
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 14,
                                  ),
                                ),
                                child: Text(
                                  _saving ? 'Saving…' : 'Create Product',
                                  style: GoogleFonts.outfit(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              'Existing Products',
                              style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (_products.isEmpty)
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  'No products yet. Add your first product above.',
                                  style: GoogleFonts.outfit(
                                    color: Colors.grey[700],
                                  ),
                                ),
                              )
                            else
                              GridView.builder(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                gridDelegate:
                                    SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount:
                                          constraints.maxWidth >= 720
                                          ? 3
                                          : constraints.maxWidth < 360
                                          ? 1
                                          : 2,
                                      mainAxisSpacing:
                                          (constraints.maxWidth * 0.04).clamp(
                                            10.0,
                                            20.0,
                                          ),
                                      crossAxisSpacing:
                                          (constraints.maxWidth * 0.04).clamp(
                                            10.0,
                                            20.0,
                                          ),
                                      childAspectRatio:
                                          constraints.maxWidth >= 720
                                          ? 0.70
                                          : constraints.maxWidth < 360
                                          ? 1.78
                                          : 0.62,
                                    ),
                                itemCount: _products.length,
                                itemBuilder: (context, index) {
                                  final product =
                                      _products[index] as Map<String, dynamic>;
                                  final id = product['_id']?.toString() ?? '';
                                  final name =
                                      product['name']?.toString() ?? 'Product';
                                  final price =
                                      (product['price'] as num?)?.toDouble() ??
                                      0;
                                  final stock =
                                      product['stockQuantity']?.toString() ??
                                      '0';
                                  final images =
                                      product['images'] as List<dynamic>? ?? [];
                                  final imageUrl = images.isNotEmpty
                                      ? images.first.toString()
                                      : null;
                                  final category = product['category'] is Map
                                      ? (product['category']?['name'] ?? '')
                                            .toString()
                                      : '';
                                  final subtitle = category.isNotEmpty
                                      ? '$stock in stock • $category'
                                      : 'Stock: $stock';
                                  return Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(12),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(
                                            alpha: 0.06,
                                          ),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          flex: 3,
                                          child: AspectRatio(
                                            aspectRatio: 1,
                                            child: Container(
                                              width: double.infinity,
                                              height: double.infinity,
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF6F1EC),
                                                borderRadius:
                                                    BorderRadius.circular(8),
                                              ),
                                              alignment: Alignment.center,
                                              child: imageUrl != null
                                                  ? ClipRRect(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            8,
                                                          ),
                                                      child: Image.network(
                                                        imageUrl,
                                                        fit: BoxFit.contain,
                                                        width: double.infinity,
                                                        height: double.infinity,
                                                        errorBuilder:
                                                            (
                                                              context,
                                                              error,
                                                              stackTrace,
                                                            ) => Icon(
                                                              Icons.pets,
                                                              size: 32,
                                                              color: primary
                                                                  .withValues(
                                                                    alpha: 0.5,
                                                                  ),
                                                            ),
                                                      ),
                                                    )
                                                  : Icon(
                                                      Icons.pets,
                                                      size: 32,
                                                      color: primary.withValues(
                                                        alpha: 0.5,
                                                      ),
                                                    ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          name,
                                          maxLines: 2,
                                          softWrap: true,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.outfit(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.black87,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          subtitle,
                                          maxLines: 1,
                                          softWrap: true,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.outfit(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w400,
                                            color: Colors.grey.shade600,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                'Rs. ${price.toStringAsFixed(0)}',
                                                maxLines: 1,
                                                softWrap: false,
                                                overflow: TextOverflow.ellipsis,
                                                style: GoogleFonts.outfit(
                                                  fontWeight: FontWeight.w500,
                                                  fontSize: 13,
                                                  color: Colors.black87,
                                                ),
                                              ),
                                            ),
                                            IconButton(
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(
                                                minWidth: 28,
                                                minHeight: 28,
                                              ),
                                              icon: const Icon(
                                                Icons.edit,
                                                size: 20,
                                              ),
                                              onPressed: () async {
                                                final controller =
                                                    TextEditingController(
                                                      text: stock,
                                                    );
                                                final result = await showDialog<String>(
                                                  context: context,
                                                  builder: (ctx) {
                                                    return AlertDialog(
                                                      title: const Text(
                                                        'Update Stock',
                                                      ),
                                                      content: TextField(
                                                        controller: controller,
                                                        keyboardType:
                                                            TextInputType
                                                                .number,
                                                        decoration:
                                                            const InputDecoration(
                                                              labelText:
                                                                  'Stock quantity',
                                                            ),
                                                      ),
                                                      actions: [
                                                        TextButton(
                                                          onPressed: () =>
                                                              Navigator.of(
                                                                ctx,
                                                              ).pop(),
                                                          child: const Text(
                                                            'Cancel',
                                                          ),
                                                        ),
                                                        TextButton(
                                                          onPressed: () =>
                                                              Navigator.of(
                                                                ctx,
                                                              ).pop(
                                                                controller.text
                                                                    .trim(),
                                                              ),
                                                          child: const Text(
                                                            'Save',
                                                          ),
                                                        ),
                                                      ],
                                                    );
                                                  },
                                                );
                                                if (result != null &&
                                                    result.isNotEmpty) {
                                                  await _updateStock(
                                                    id,
                                                    result,
                                                  );
                                                }
                                              },
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                          ],
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategorySection(Color primary) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Add Category',
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _categoryNameController,
            label: 'Category Name *',
            hint: 'e.g. Food, Toys, Medicine',
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              ElevatedButton(
                onPressed: () async {
                  final file = await _picker.pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 85,
                  );
                  if (file != null) {
                    setState(() => _categoryImage = file);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: primary,
                  foregroundColor: Colors.white,
                ),
                child: Text(
                  'Choose Image',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w500),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  _categoryImage == null
                      ? 'No image selected'
                      : 'Image selected',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: Colors.grey[700],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _creatingCategory ? null : _createCategory,
              style: ElevatedButton.styleFrom(
                backgroundColor: primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 10),
              ),
              child: Text(
                _creatingCategory ? 'Creating…' : 'Create Category',
                style: GoogleFonts.outfit(fontWeight: FontWeight.w500),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    int maxLines = 1,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}
