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
  final String? pawId;
  /// Display status: 'Healthy', 'Attention', 'Sick'. From API or derived.
  final String? healthStatus;
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
    this.pawId,
    this.healthStatus,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Pet.fromJson(Map<String, dynamic> json) {
    try {
      if (json.isEmpty) {
        return Pet(
          id: '',
          owner: '',
          name: '',
          species: '',
          gender: '',
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        );
      }
      final ownerVal = json['owner'];
      final ownerStr = ownerVal is String
          ? ownerVal
          : ownerVal is Map
          ? (ownerVal['_id'] ?? ownerVal['id'] ?? '').toString()
          : ownerVal?.toString() ?? '';
      final rawMedical = json['medicalHistory'];
      List<String> medicalHistory = [];
      if (rawMedical is List) {
        medicalHistory = rawMedical
            .map((e) => e?.toString() ?? '')
            .where((s) => s.isNotEmpty)
            .toList();
      }
      return Pet(
        id: (json['_id'] ?? '').toString(),
        owner: ownerStr,
        name: (json['name'] ?? '').toString(),
        species: (json['species'] ?? '').toString(),
        breed: json['breed']?.toString(),
        dob: json['dob'] != null
            ? DateTime.tryParse(json['dob'].toString())
            : null,
        age: json['age'] is int
            ? json['age'] as int
            : json['age'] != null
            ? int.tryParse(json['age'].toString())
            : null,
        gender: (json['gender'] ?? '').toString(),
        weight: json['weight'] != null && json['weight'] is num
            ? (json['weight'] as num).toDouble()
            : double.tryParse(json['weight']?.toString() ?? ''),
        photoUrl: json['photoUrl']?.toString(),
        medicalConditions: json['medicalConditions']?.toString(),
        behavioralNotes: json['behavioralNotes']?.toString(),
        isVaccinated:
            json['isVaccinated'] == true ||
            json['isVaccinated']?.toString().toLowerCase() == 'true',
        medicalHistory: medicalHistory,
        pawId: json['pawId']?.toString(),
        healthStatus: _parseHealthStatus(json),
        createdAt:
            DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
            DateTime.now(),
        updatedAt:
            DateTime.tryParse(json['updatedAt']?.toString() ?? '') ??
            DateTime.now(),
      );
    } catch (e, stack) {
      assert(() {
        // ignore: avoid_print
        print('Pet.fromJson error: $e\n$stack');
        return true;
      }());
      return Pet(
        id: (json['_id'] ?? '').toString(),
        owner: '',
        name: (json['name'] ?? '').toString(),
        species: (json['species'] ?? '').toString(),
        gender: (json['gender'] ?? '').toString(),
        healthStatus: _parseHealthStatus(json),
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
    }
  }

  static String? _parseHealthStatus(Map<String, dynamic> json) {
    final status = json['healthStatus'] ?? json['status'];
    if (status != null && status.toString().trim().isNotEmpty) {
      final s = status.toString().trim().toLowerCase();
      if (s == 'healthy') return 'Healthy';
      if (s == 'attention' || s == 'sick') return 'Attention';
      return status.toString().trim();
    }
    return null;
  }

  /// Status for UI: Healthy, Attention, or Sick. Defaults to Healthy if unset.
  String get displayHealthStatus {
    if (healthStatus != null && healthStatus!.trim().isNotEmpty) {
      final s = healthStatus!.trim().toLowerCase();
      if (s == 'sick') return 'Sick';
      if (s == 'attention') return 'Attention';
      return 'Healthy';
    }
    if (medicalConditions != null && medicalConditions!.trim().isNotEmpty) {
      return 'Attention';
    }
    return 'Healthy';
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
      'pawId': pawId,
      'healthStatus': healthStatus,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}
