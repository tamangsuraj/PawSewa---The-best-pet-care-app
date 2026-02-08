class Appointment {
  final String id;
  final String pet;
  final String owner;
  final String veterinarian;
  final DateTime date;
  final String timeSlot;
  final String status;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Appointment({
    required this.id,
    required this.pet,
    required this.owner,
    required this.veterinarian,
    required this.date,
    required this.timeSlot,
    required this.status,
    this.createdAt,
    this.updatedAt,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['_id'] ?? json['id'] ?? '',
      pet: json['pet'] is String 
          ? json['pet'] 
          : json['pet']?['_id'] ?? '',
      owner: json['owner'] is String 
          ? json['owner'] 
          : json['owner']?['_id'] ?? '',
      veterinarian: json['veterinarian'] is String 
          ? json['veterinarian'] 
          : json['veterinarian']?['_id'] ?? '',
      date: DateTime.parse(json['date']),
      timeSlot: json['timeSlot'] ?? '',
      status: json['status'] ?? 'pending',
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
      'pet': pet,
      'owner': owner,
      'veterinarian': veterinarian,
      'date': date.toIso8601String(),
      'timeSlot': timeSlot,
      'status': status,
      'createdAt': createdAt?.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }
}

enum AppointmentStatus {
  pending('pending'),
  confirmed('confirmed'),
  completed('completed'),
  cancelled('cancelled');

  final String value;
  const AppointmentStatus(this.value);

  static AppointmentStatus fromString(String status) {
    switch (status) {
      case 'pending':
        return AppointmentStatus.pending;
      case 'confirmed':
        return AppointmentStatus.confirmed;
      case 'completed':
        return AppointmentStatus.completed;
      case 'cancelled':
        return AppointmentStatus.cancelled;
      default:
        return AppointmentStatus.pending;
    }
  }
}
