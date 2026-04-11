import 'package:dio/dio.dart';

import 'api_client.dart';

/// Detects older APIs whose PATCH `/service-requests/status/:id` only allowed
/// `assigned, in_progress, completed, cancelled` (no home-visit flow).
bool isLegacyServiceRequestStatusErrorMessage(String message) {
  final m = message.toLowerCase();
  return m.contains('invalid status') &&
      m.contains('must be one of') &&
      !m.contains('en_route') &&
      !m.contains('arrived') &&
      !m.contains('accepted');
}

String? _dioErrorMessage(DioException e) {
  final data = e.response?.data;
  if (data is Map) {
    final o = data['message'];
    if (o is String && o.isNotEmpty) return o;
  }
  return e.message;
}

/// PATCH visit status, or fall back to [ApiClient.startServiceRequestVisit] when
/// the running backend is pre–home-visit-flow (accept / on-the-way must map to start).
Future<Response> applyVetServiceRequestStatus(
  ApiClient api, {
  required String requestId,
  required String nextStatus,
  required String? currentStatus,
}) async {
  try {
    return await api.updateServiceStatus(requestId: requestId, status: nextStatus);
  } on DioException catch (e) {
    if (e.response?.statusCode != 400) rethrow;
    final msg = _dioErrorMessage(e) ?? '';
    if (!isLegacyServiceRequestStatusErrorMessage(msg)) rethrow;

    final cur = currentStatus ?? '';

    if (nextStatus == 'accepted') {
      return await api.startServiceRequestVisit(requestId);
    }
    if (nextStatus == 'en_route' && cur == 'assigned') {
      return await api.startServiceRequestVisit(requestId);
    }
    rethrow;
  }
}
