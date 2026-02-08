class Pet {
  final String id;
  final String owner;
  final String name;
  final String species;
  final String? breed;
  final int? age;
  final double? weight;
  final String? image;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Pet({
    required this.id,
    required this.owner,
    required this.name,
    required this.species,
    this.breed,
    this.age,
    this.weight,
    this.image,
    this.createdAt,
    this.updatedAt,
  });

  factory Pet.fromJson(Map<String, dynamic> json) {
    return Pet(
      id: json['_id'] ?? json['id'] ?? '',
      owner: json['owner'] is String 
          ? json['owner'] 
          : json['owner']?['_id'] ?? '',
      name: json['name'] ?? '',
      species: json['species'] ?? '',
      breed: json['breed'],
      age: json['age']?.toInt(),
      weight: json['weight']?.toDouble(),
      image: json['image'],
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
      'owner': owner,
      'name': name,
      'species': species,
      'breed': breed,
      'age': age,
      'weight': weight,
      'image': image,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}
