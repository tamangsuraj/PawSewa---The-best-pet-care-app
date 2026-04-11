/// Agora channel names: max 64 chars, allowed charset per Agora docs.
String vetDirectRtcChannel(String ownerId, String vetId) {
  final parts = [ownerId, vetId]..sort();
  var s = 'vd_${parts[0]}_${parts[1]}'.replaceAll(RegExp(r'[^a-zA-Z0-9 _.\-:@#+]'), '_');
  if (s.length > 64) {
    s = s.substring(0, 64);
  }
  return s.isEmpty ? 'pawsewa_vd' : s;
}

/// 1:1 Customer Care (owner or partner ↔ PawSewa care admin).
String customerCareRtcChannel(String userId, String careAdminId) {
  final parts = [userId, careAdminId]..sort();
  var s = 'cc_${parts[0]}_${parts[1]}'.replaceAll(RegExp(r'[^a-zA-Z0-9 _.\-:@#+]'), '_');
  if (s.length > 64) {
    s = s.substring(0, 64);
  }
  return s.isEmpty ? 'pawsewa_cc' : s;
}

String marketplaceRtcChannel(String conversationId) {
  final ts = DateTime.now().millisecondsSinceEpoch.toString();
  var s = 'mp_${conversationId}_$ts'.replaceAll(RegExp(r'[^a-zA-Z0-9 _.\-:@#+]'), '_');
  if (s.length > 64) {
    final suffix = '_$ts';
    final keep = (64 - suffix.length).clamp(1, 64);
    s = s.substring(0, keep) + suffix;
    if (s.length > 64) s = s.substring(0, 64);
  }
  return s.isEmpty ? 'pawsewa_mp' : s;
}
