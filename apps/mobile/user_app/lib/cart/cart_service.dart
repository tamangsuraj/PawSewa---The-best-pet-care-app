import 'package:flutter/foundation.dart';

class CartItem {
  CartItem({
    required this.productId,
    required this.name,
    required this.price,
    this.quantity = 1,
  });

  final String productId;
  final String name;
  final double price;
  int quantity;
}

class CartService extends ChangeNotifier {
  final Map<String, CartItem> _items = {};
  double? _deliveryLat;
  double? _deliveryLng;
  String? _deliveryAddress;
  String? _deliveryNotes;

  Map<String, CartItem> get items => _items;
  double? get deliveryLat => _deliveryLat;
  double? get deliveryLng => _deliveryLng;
  String? get deliveryAddress => _deliveryAddress;
  String? get deliveryNotes => _deliveryNotes;

  void addItem({
    required String productId,
    required String name,
    required double price,
  }) {
    if (_items.containsKey(productId)) {
      _items[productId]!.quantity++;
    } else {
      _items[productId] = CartItem(
        productId: productId,
        name: name,
        price: price,
      );
    }
    notifyListeners();
  }

  void removeItem(String productId) {
    _items.remove(productId);
    notifyListeners();
  }

  void updateQuantity(String productId, int quantity) {
    if (!_items.containsKey(productId)) return;
    if (quantity <= 0) {
      _items.remove(productId);
    } else {
      _items[productId]!.quantity = quantity;
    }
    notifyListeners();
  }

  void setDeliveryLocation({
    required double lat,
    required double lng,
    required String address,
  }) {
    _deliveryLat = lat;
    _deliveryLng = lng;
    _deliveryAddress = address;
    notifyListeners();
  }

  void setDeliveryNotes(String? notes) {
    final trimmed = notes?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      _deliveryNotes = null;
    } else {
      _deliveryNotes = trimmed.length > 500 ? trimmed.substring(0, 500) : trimmed;
    }
    notifyListeners();
  }

  void clearCart() {
    _items.clear();
    _deliveryNotes = null;
    notifyListeners();
  }

  double get subtotal =>
      _items.values.fold(0.0, (sum, item) => sum + item.price * item.quantity);

  double get deliveryFee {
    if (_deliveryLat == null || _deliveryLng == null) return 0;
    return 100; // NPR flat; replace with distance-based logic if needed
  }

  double get total => subtotal + deliveryFee;
}

