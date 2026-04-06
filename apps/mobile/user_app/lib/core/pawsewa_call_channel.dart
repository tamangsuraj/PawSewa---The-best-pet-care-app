/// Agora channel names: max 64 chars, allowed charset per Agora docs.
String vetDirectRtcChannel(String ownerId, String vetId) {
  final parts = [ownerId, vetId]..sort();
  var s = 'vd_${parts[0]}_${parts[1]}'.replaceAll(RegExp(r'[^a-zA-Z0-9 _.\-:@#+]'), '_');
  if (s.length > 64) {
    s = s.substring(0, 64);
  }
  return s.isEmpty ? 'pawsewa_vd' : s;
}
