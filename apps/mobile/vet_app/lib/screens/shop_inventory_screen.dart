import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api_client.dart';
import '../core/constants.dart';

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

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _priceController.dispose();
    _stockController.dispose();
    _descriptionController.dispose();
    super.dispose();
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
            await MultipartFile.fromFile(
              image.path,
              filename: filename,
            ),
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to create product: $e')),
      );
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Stock updated')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to update stock: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = const Color(AppConstants.primaryColor);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Shop Inventory',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: primary,
        foregroundColor: Colors.white,
      ),
      backgroundColor: const Color(AppConstants.secondaryColor),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(),
            )
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
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
                        style: GoogleFonts.poppins(color: Colors.red[700]),
                      ),
                    ),
                  Text(
                    'Add New Product',
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _buildTextField(
                    controller: _nameController,
                    label: 'Name *',
                    hint: 'Product name',
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Images (optional)',
                    style: GoogleFonts.poppins(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      ElevatedButton(
                        onPressed: () async {
                          final images = await _picker.pickMultiImage(
                            imageQuality: 85,
                          );
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
                          style: GoogleFonts.poppins(fontWeight: FontWeight.w500),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _selectedImages.isEmpty
                              ? 'No images selected'
                              : '${_selectedImages.length} image(s) selected',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: Colors.grey[700],
                          ),
                          maxLines: 2,
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
                            child: Text(c['name']?.toString() ?? 'Category'),
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
                        thumbColor: WidgetStateProperty.resolveWith<Color?>(
                          (states) =>
                              states.contains(WidgetState.selected) ? primary : null,
                        ),
                        onChanged: (v) {
                          setState(() {
                            _isAvailable = v;
                          });
                        },
                      ),
                      Text(
                        'Active / visible in apps',
                        style: GoogleFonts.poppins(fontSize: 13),
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
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text(
                        _saving ? 'Saving…' : 'Create Product',
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Existing Products',
                    style: GoogleFonts.poppins(
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
                        style: GoogleFonts.poppins(color: Colors.grey[700]),
                      ),
                    )
                  else
                    ListView.builder(
                      itemCount: _products.length,
                      physics: const NeverScrollableScrollPhysics(),
                      shrinkWrap: true,
                      itemBuilder: (context, index) {
                        final product =
                            _products[index] as Map<String, dynamic>;
                        final id = product['_id']?.toString() ?? '';
                        final name = product['name']?.toString() ?? 'Product';
                        final price =
                            (product['price'] as num?)?.toDouble() ?? 0;
                        final stock =
                            product['stockQuantity']?.toString() ?? '0';
                        final isAvailable = product['isAvailable'] == true;
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: GoogleFonts.poppins(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'NPR ${price.toStringAsFixed(0)} • Stock: $stock',
                                      style: GoogleFonts.poppins(
                                        fontSize: 12,
                                        color: Colors.grey[700],
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      isAvailable ? 'Active' : 'Inactive',
                                      style: GoogleFonts.poppins(
                                        fontSize: 11,
                                        color:
                                            isAvailable ? Colors.green : Colors.red,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.edit),
                                onPressed: () async {
                                  final controller =
                                      TextEditingController(text: stock);
                                  final result = await showDialog<String>(
                                    context: context,
                                    builder: (ctx) {
                                      return AlertDialog(
                                        title: const Text('Update Stock'),
                                        content: TextField(
                                          controller: controller,
                                          keyboardType: TextInputType.number,
                                          decoration: const InputDecoration(
                                            labelText: 'Stock quantity',
                                          ),
                                        ),
                                        actions: [
                                          TextButton(
                                            onPressed: () =>
                                                Navigator.of(ctx).pop(),
                                            child: const Text('Cancel'),
                                          ),
                                          TextButton(
                                            onPressed: () => Navigator.of(ctx)
                                                .pop(controller.text.trim()),
                                            child: const Text('Save'),
                                          ),
                                        ],
                                      );
                                    },
                                  );
                                  if (result != null && result.isNotEmpty) {
                                    await _updateStock(id, result);
                                  }
                                },
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                ],
              ),
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
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    );
  }
}

