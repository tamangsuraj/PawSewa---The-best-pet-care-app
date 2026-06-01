/// Must match backend `sanitizeChannelName` in agoraController.js.
String sanitizeAgoraChannel(String raw) {
  var s = raw.trim();
  if (s.length > 64) s = s.substring(0, 64);
  s = s.replaceAll(RegExp(r'[^a-zA-Z0-9 !#\-./:?@\[\]^_`{|}~,]'), '_');
  return s.isEmpty ? 'pawsewa_call' : s;
}
