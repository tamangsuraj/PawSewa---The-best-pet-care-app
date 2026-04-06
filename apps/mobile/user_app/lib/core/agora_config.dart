/// Agora RTC App ID (safe on client). Token + certificate stay on the server only.
/// Override at build: `--dart-define=AGORA_APP_ID=your_id`
class AgoraConfig {
  AgoraConfig._();

  static const String appId = String.fromEnvironment(
    'AGORA_APP_ID',
    defaultValue: 'a6a42b00b6ca4e059dcc1f1866950ad1',
  );
}
