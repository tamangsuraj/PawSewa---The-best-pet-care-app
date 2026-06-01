import 'agora_channel_util.dart';

/// Agora channel names: max 64 chars, allowed charset per Agora docs.
String vetDirectRtcChannel(String ownerId, String vetId) {
  final parts = [ownerId, vetId]..sort();
  return sanitizeAgoraChannel('vd_${parts[0]}_${parts[1]}');
}

/// 1:1 Customer Care (owner or partner ↔ PawSewa care admin).
String customerCareRtcChannel(String userId, String careAdminId) {
  final parts = [userId, careAdminId]..sort();
  return sanitizeAgoraChannel('cc_${parts[0]}_${parts[1]}');
}

/// Stable 1:1 channel for a marketplace thread (partner ↔ customer).
String marketplaceRtcChannel(String conversationId) {
  return sanitizeAgoraChannel('mp_$conversationId');
}
