class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.createdAt,
    this.updatedAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'pet_owner',
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt']) 
          : null,
      updatedAt: json['updatedAt'] != null 
          ? DateTime.parse(json['updatedAt']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'email': email,
      'role': role,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}

enum UserRole {
  petOwner('pet_owner'),
  veterinarian('veterinarian'),
  admin('admin');

  final String value;
  const UserRole(this.value);

  static UserRole fromString(String role) {
    switch (role) {
      case 'pet_owner':
        return UserRole.petOwner;
      case 'veterinarian':
        return UserRole.veterinarian;
      case 'admin':
        return UserRole.admin;
      default:
        return UserRole.petOwner;
    }
  }
}
