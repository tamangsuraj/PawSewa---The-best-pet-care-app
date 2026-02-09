class Pet {
  final String id;
  final String owner;
  final String name;
  final String species;
  final String? breed;
  final DateTime? dob;
  final int? age;
  final String gender;
  final double? weight;
  final String? photoUrl;
  final String? medicalConditions;
  final String? behavioralNotes;
  final bool isVaccinated;
  final List<String> medicalHistory;
  final DateTime createdAt;
  final DateTime updatedAt;

  Pet({
    required this.id,
    required this.owner,
    required this.name,
    required this.species,
    this.breed,
    this.dob,
    this.age,
    required this.gender,
    this.weight,
    this.photoUrl,
    this.medicalConditions,
    this.behavioralNotes,
    this.isVaccinated = false,
    this.medicalHistory = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory Pet.fromJson(Map<String, dynamic> json) {
    return Pet(
      id: json['_id'] ?? '',
      owner: json['owner'] ?? '',
      name: json['name'] ?? '',
      species: json['species'] ?? '',
      breed: json['breed'],
      dob: json['dob'] != null ? DateTime.parse(json['dob']) : null,
      age: json['age'],
      gender: json['gender'] ?? '',
      weight: json['weight']?.toDouble(),
      photoUrl: json['photoUrl'],
      medicalConditions: json['medicalConditions'],
      behavioralNotes: json['behavioralNotes'],
      isVaccinated: json['isVaccinated'] ?? false,
      medicalHistory: json['medicalHistory'] != null
          ? List<String>.from(json['medicalHistory'])
          : [],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: DateTime.parse(json['updatedAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'owner': owner,
      'name': name,
      'species': species,
      'breed': breed,
      'dob': dob?.toIso8601String(),
      'age': age,
      'gender': gender,
      'weight': weight,
      'photoUrl': photoUrl,
      'medicalConditions': medicalConditions,
      'behavioralNotes': behavioralNotes,
      'isVaccinated': isVaccinated,
      'medicalHistory': medicalHistory,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
