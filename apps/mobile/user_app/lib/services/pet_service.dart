import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../models/pet.dart';
import '../core/api_config.dart';
import '../core/storage_service.dart';

class PetService {
  final Dio _dio = Dio();
  final StorageService _storage = StorageService();

  PetService() {
    _dio.options.connectTimeout = const Duration(seconds: 30);
    _dio.options.receiveTimeout = const Duration(seconds: 30);
  }

  Future<void> _ensureBaseUrl() async {
    _dio.options.baseUrl = await ApiConfig.getBaseUrl();
  }

  Future<String?> _getToken() async {
    return await _storage.getToken();
  }

  Future<List<Pet>> getMyPets() async {
    await _ensureBaseUrl();
    try {
      final token = await _getToken();
      if (token == null) return [];

      final response = await _dio.get(
        '/pets/my-pets',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200 && response.data['success']) {
        final data = response.data['data'];
        if (data == null || data is! List) return [];
        final List<Pet> result = [];
        for (final item in data) {
          try {
            final map = item is Map ? Map<String, dynamic>.from(item) : null;
            if (map != null) result.add(Pet.fromJson(map));
          } catch (parseErr) {
            if (kDebugMode) {
              debugPrint('Error parsing pet: $parseErr');
            }
          }
        }
        return result;
      }
      return [];
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error fetching pets: $e');
      }
      return [];
    }
  }

  /// GET /pets/:id/health-summary — returns pet + age (display), visit_days_ago
  Future<Map<String, dynamic>?> getPetHealthSummary(String petId) async {
    await _ensureBaseUrl();
    try {
      final token = await _getToken();
      if (token == null) return null;

      final response = await _dio.get(
        '/pets/$petId/health-summary',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200 && response.data['success'] == true) {
        final data = response.data['data'];
        return data is Map ? Map<String, dynamic>.from(data) : null;
      }
      return null;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error fetching pet health summary: $e');
      }
      return null;
    }
  }

  Future<Pet> createPet({
    required String name,
    required String species,
    required String gender,
    String? breed,
    DateTime? dob,
    int? age,
    double? weight,
    String? medicalConditions,
    String? behavioralNotes,
    bool? isVaccinated,
    File? photo,
    List<String>? medicalHistory,
  }) async {
    try {
      final token = await _getToken();
      if (token == null) throw Exception('No authentication token found');

      // Use http package for multipart upload
      final baseUrl = await ApiConfig.getBaseUrl();
      final uri = Uri.parse('$baseUrl/pets');
      final request = http.MultipartRequest('POST', uri);

      // Add headers
      request.headers['Authorization'] = 'Bearer $token';

      // Add fields
      request.fields['name'] = name;
      request.fields['species'] = species;
      request.fields['gender'] = gender;
      if (breed != null) request.fields['breed'] = breed;
      if (dob != null) request.fields['dob'] = dob.toIso8601String();
      if (age != null) request.fields['age'] = age.toString();
      if (weight != null) request.fields['weight'] = weight.toString();
      if (medicalConditions != null) {
        request.fields['medicalConditions'] = medicalConditions;
      }
      if (behavioralNotes != null) {
        request.fields['behavioralNotes'] = behavioralNotes;
      }
      if (isVaccinated != null) {
        request.fields['isVaccinated'] = isVaccinated.toString();
      }
      if (medicalHistory != null && medicalHistory.isNotEmpty) {
        request.fields['medicalHistory'] = medicalHistory.join(',');
      }

      // Add photo if provided
      if (photo != null) {
        final stream = http.ByteStream(photo.openRead());
        final length = await photo.length();

        // Determine content type based on file extension
        String contentType = 'image/jpeg'; // default
        final extension = photo.path.split('.').last.toLowerCase();
        if (extension == 'png') {
          contentType = 'image/png';
        } else if (extension == 'jpg' || extension == 'jpeg') {
          contentType = 'image/jpeg';
        } else if (extension == 'gif') {
          contentType = 'image/gif';
        } else if (extension == 'webp') {
          contentType = 'image/webp';
        }

        final multipartFile = http.MultipartFile(
          'photo',
          stream,
          length,
          filename: photo.path.split('/').last,
          contentType: MediaType.parse(contentType),
        );
        request.files.add(multipartFile);
      }

      // Send request
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 201) {
        final responseData = json.decode(response.body);

        if (responseData['success']) {
          return Pet.fromJson(responseData['data']);
        }
      }

      throw Exception('Failed to create pet: ${response.body}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error creating pet: $e');
      }
      rethrow;
    }
  }

  Future<Pet> updatePet({
    required String petId,
    String? name,
    String? species,
    String? gender,
    String? breed,
    DateTime? dob,
    int? age,
    double? weight,
    String? medicalConditions,
    String? behavioralNotes,
    bool? isVaccinated,
    File? photo,
    List<String>? medicalHistory,
  }) async {
    try {
      final token = await _getToken();
      if (token == null) throw Exception('No authentication token found');

      // Use http package for multipart upload
      final baseUrl = await ApiConfig.getBaseUrl();
      final uri = Uri.parse('$baseUrl/pets/$petId');
      final request = http.MultipartRequest('PUT', uri);

      // Add headers
      request.headers['Authorization'] = 'Bearer $token';

      // Add fields
      if (name != null) request.fields['name'] = name;
      if (species != null) request.fields['species'] = species;
      if (gender != null) request.fields['gender'] = gender;
      if (breed != null) request.fields['breed'] = breed;
      if (dob != null) request.fields['dob'] = dob.toIso8601String();
      if (age != null) request.fields['age'] = age.toString();
      if (weight != null) request.fields['weight'] = weight.toString();
      if (medicalConditions != null) {
        request.fields['medicalConditions'] = medicalConditions;
      }
      if (behavioralNotes != null) {
        request.fields['behavioralNotes'] = behavioralNotes;
      }
      if (isVaccinated != null) {
        request.fields['isVaccinated'] = isVaccinated.toString();
      }
      if (medicalHistory != null) {
        request.fields['medicalHistory'] = medicalHistory.join(',');
      }

      // Add photo if provided
      if (photo != null) {
        final stream = http.ByteStream(photo.openRead());
        final length = await photo.length();

        // Determine content type based on file extension
        String contentType = 'image/jpeg'; // default
        final extension = photo.path.split('.').last.toLowerCase();
        if (extension == 'png') {
          contentType = 'image/png';
        } else if (extension == 'jpg' || extension == 'jpeg') {
          contentType = 'image/jpeg';
        } else if (extension == 'gif') {
          contentType = 'image/gif';
        } else if (extension == 'webp') {
          contentType = 'image/webp';
        }

        final multipartFile = http.MultipartFile(
          'photo',
          stream,
          length,
          filename: photo.path.split('/').last,
          contentType: MediaType.parse(contentType),
        );
        request.files.add(multipartFile);
      }

      // Send request
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);

        if (responseData['success']) {
          return Pet.fromJson(responseData['data']);
        }
      }

      throw Exception('Failed to update pet: ${response.body}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error updating pet: $e');
      }
      rethrow;
    }
  }

  Future<void> deletePet(String petId) async {
    await _ensureBaseUrl();
    try {
      final token = await _getToken();
      if (token == null) throw Exception('No authentication token found');

      final response = await _dio.delete(
        '/pets/$petId',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode != 200 || !response.data['success']) {
        throw Exception('Failed to delete pet');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('Error deleting pet: $e');
      }
      rethrow;
    }
  }
}
