import 'package:agora_rtc_engine/agora_rtc_engine.dart';

/// Errors that should end the call UI; transient network glitches are ignored.
bool isFatalAgoraError(ErrorCodeType err) {
  return err == ErrorCodeType.errInvalidToken ||
      err == ErrorCodeType.errTokenExpired ||
      err == ErrorCodeType.errJoinChannelRejected ||
      err == ErrorCodeType.errInvalidAppId ||
      err == ErrorCodeType.errInvalidChannelName ||
      err == ErrorCodeType.errNotInitialized ||
      err == ErrorCodeType.errNoPermission ||
      err == ErrorCodeType.errRefused ||
      err == ErrorCodeType.errInvalidArgument;
}

/// User-facing text for Agora SDK failures.
String agoraErrorMessage(Object error, [String? fallback]) {
  if (error is AgoraRtcException) {
    switch (error.code) {
      case -17:
        return 'Could not join the call (invalid token). Restart the app and try again.';
      case -2:
        return 'Call setup failed. Check camera/mic permissions and try again.';
      case -5:
        return 'Call was refused or timed out.';
      case -7:
        return 'Call engine is not ready. Please try again.';
      default:
        return 'Call failed (code ${error.code}).';
    }
  }
  if (error is Exception) {
    return error.toString().replaceFirst('Exception: ', '');
  }
  return fallback ?? 'Call connection failed.';
}
