import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:user_app/widgets/paw_sewa_loader.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../core/agora_config.dart';
import '../../core/api_client.dart';
import '../../core/constants.dart';
import '../../services/ongoing_call_service.dart';
import '../../services/socket_service.dart';

/// Full-screen Agora call for vet-direct threads (signaling via Socket.io).
class AgoraVetDirectCallScreen extends StatefulWidget {
  const AgoraVetDirectCallScreen({
    super.key,
    required this.channelName,
    required this.myUserId,
    required this.peerUserId,
    required this.peerName,
    required this.localDisplayName,
    required this.video,
    required this.iAmCaller,
    this.appointmentId,
    this.careBookingId,
    this.answerAlreadySent = false,
  });

  final String channelName;
  final String myUserId;
  final String peerUserId;
  final String peerName;
  final String localDisplayName;
  final bool video;
  final bool iAmCaller;
  final String? appointmentId;
  final String? careBookingId;
  final bool answerAlreadySent;

  @override
  State<AgoraVetDirectCallScreen> createState() =>
      _AgoraVetDirectCallScreenState();
}

class _AgoraVetDirectCallScreenState extends State<AgoraVetDirectCallScreen>
    with TickerProviderStateMixin {
  final _api = ApiClient();
  final _socket = SocketService.instance;
  OngoingCallService? _ongoing;

  RtcEngine? _engine;
  late final RtcEngineEventHandler _handler;

  bool _busy = true;
  String? _error;
  int? _localUid;
  int? _remoteUid;
  DateTime? _joinedAt;
  bool _muted = false;
  bool _cleanedUp = false;
  Offset _pipOffset = const Offset(12, 72);
  bool _beganOngoing = false;

  late AnimationController _pulse;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _ongoing ??= context.read<OngoingCallService>();
    if (!_beganOngoing) {
      _beganOngoing = true;
      _ongoing?.begin(label: 'Ongoing call');
    }
  }

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _handler = RtcEngineEventHandler(
      onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
        if (!mounted) return;
        setState(() {
          _localUid = connection.localUid;
          _joinedAt ??= DateTime.now();
          _busy = false;
        });
      },
      onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
        if (!mounted) return;
        setState(() => _remoteUid = remoteUid);
      },
      onUserOffline: (RtcConnection connection, int remoteUid,
          UserOfflineReasonType reason) {
        if (remoteUid == _remoteUid) {
          unawaited(_cleanup(remoteEnded: true));
        }
      },
      onError: (ErrorCodeType err, String msg) {
        if (kDebugMode) {
          debugPrint('[Agora] onError $err $msg');
        }
      },
    );

    _socket.addCallEndedListener(_onSocketCallEnded);
    if (widget.iAmCaller) {
      _socket.addCallAnsweredListener(_onSocketCallAnswered);
    }
    unawaited(_run());
  }

  void _onSocketCallEnded(Map<String, dynamic> data) {
    if (data['channelName']?.toString() != widget.channelName) return;
    unawaited(_cleanup(remoteEnded: true));
  }

  void _onSocketCallAnswered(Map<String, dynamic> data) {
    if (!widget.iAmCaller) return;
    if (data['channelName']?.toString() != widget.channelName) return;
    if (kDebugMode) debugPrint('[Agora] call_answered (socket)');
  }

  Future<void> _ensurePermissions() async {
    final mic = await Permission.microphone.request();
    if (!mic.isGranted) {
      throw Exception('Microphone permission is required for calls.');
    }
    if (widget.video) {
      final cam = await Permission.camera.request();
      if (!cam.isGranted) {
        throw Exception('Camera permission is required for video calls.');
      }
    }
  }

  Future<Map<String, dynamic>> _fetchToken() async {
    final res = await _api.getAgoraRtcToken(channelName: widget.channelName);
    final body = res.data;
    if (body is! Map || body['success'] != true) {
      throw Exception('Could not get call token.');
    }
    final data = body['data'] as Map<String, dynamic>?;
    if (data == null) throw Exception('Invalid token response.');
    return data;
  }

  Future<void> _run() async {
    try {
      await _ensurePermissions();
      final tokenPayload = await _fetchToken();
      final token = tokenPayload['token']?.toString() ?? '';
      final uid = (tokenPayload['uid'] is int)
          ? tokenPayload['uid'] as int
          : int.tryParse('${tokenPayload['uid']}') ?? 0;
      if (token.isEmpty || uid < 1) {
        throw Exception('Invalid token from server.');
      }

      if (widget.iAmCaller) {
        _socket.emitMakeCall(
          toUserId: widget.peerUserId,
          channelName: widget.channelName,
          callType: widget.video ? 'video' : 'audio',
          callerName: widget.localDisplayName.isNotEmpty
              ? widget.localDisplayName
              : 'Caller',
        );
      } else if (!widget.answerAlreadySent) {
        _socket.emitAnswerCall(
          toUserId: widget.peerUserId,
          channelName: widget.channelName,
        );
      }

      final engine = createAgoraRtcEngine();
      await engine.initialize(RtcEngineContext(
        appId: AgoraConfig.appId,
        channelProfile: ChannelProfileType.channelProfileCommunication,
        areaCode: AreaCode.areaCodeAs.value(),
      ));
      engine.registerEventHandler(_handler);
      await engine.setClientRole(role: ClientRoleType.clientRoleBroadcaster);
      await engine.enableAudio();
      if (widget.video) {
        await engine.enableVideo();
        await engine.startPreview();
      } else {
        await engine.disableVideo();
      }

      _engine = engine;

      await engine.joinChannel(
        token: token,
        channelId: widget.channelName,
        uid: uid,
        options: ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileCommunication,
          clientRoleType: ClientRoleType.clientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: widget.video,
          autoSubscribeAudio: true,
          autoSubscribeVideo: widget.video,
        ),
      );

      if (mounted) setState(() => _busy = false);
    } on DioException catch (e) {
      final msg = e.response?.data is Map &&
              (e.response!.data as Map)['message'] != null
          ? (e.response!.data as Map)['message'].toString()
          : e.message;
      if (mounted) {
        setState(() {
          _busy = false;
          _error = msg ?? 'Connection error.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<void> _postLog(int seconds) async {
    try {
      await _api.postCallLog({
        'channelName': widget.channelName,
        'durationSeconds': seconds,
        'callType': widget.video ? 'video' : 'audio',
        'peerUserId': widget.peerUserId,
        'iWasCaller': widget.iAmCaller,
        if (widget.appointmentId != null && widget.appointmentId!.isNotEmpty)
          'appointmentId': widget.appointmentId,
        if (widget.careBookingId != null && widget.careBookingId!.isNotEmpty)
          'careBookingId': widget.careBookingId,
      });
    } catch (_) {}
  }

  Future<void> _cleanup({
    bool remoteEnded = false,
    bool fromDispose = false,
  }) async {
    if (_cleanedUp) return;
    _cleanedUp = true;

    final secs = _joinedAt != null
        ? DateTime.now().difference(_joinedAt!).inSeconds
        : 0;

    _socket.removeCallEndedListener(_onSocketCallEnded);
    if (widget.iAmCaller) {
      _socket.removeCallAnsweredListener(_onSocketCallAnswered);
    }

    if (!remoteEnded) {
      _socket.emitHangUp(
        toUserId: widget.peerUserId,
        channelName: widget.channelName,
        durationSeconds: secs,
      );
      await _postLog(secs);
    }

    _ongoing?.end();

    try {
      await _engine?.leaveChannel();
    } catch (_) {}
    try {
      if (_engine != null) {
        _engine!.unregisterEventHandler(_handler);
      }
      await _engine?.release();
    } catch (_) {}
    _engine = null;

    if (!fromDispose && mounted) {
      Navigator.of(context, rootNavigator: true).maybePop();
    }
  }

  Future<void> _toggleMute() async {
    final e = _engine;
    if (e == null) return;
    final next = !_muted;
    await e.muteLocalAudioStream(next);
    setState(() => _muted = next);
  }

  Future<void> _flipCamera() async {
    await _engine?.switchCamera();
  }

  @override
  void dispose() {
    _pulse.dispose();
    if (!_cleanedUp) {
      unawaited(_cleanup(remoteEnded: false, fromDispose: true));
    }
    super.dispose();
  }

  static const Color _brown = Color(AppConstants.primaryColor);

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(color: Colors.white70),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: FilledButton.styleFrom(backgroundColor: _brown),
                    child: const Text('Close'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final engine = _engine;
    final local = _localUid ?? 0;
    final showRemoteVideo =
        widget.video && engine != null && (_remoteUid != null);

    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (_busy)
              const Center(
                child: PawSewaLoader(width: 36, center: false),
              )
            else if (widget.video && engine != null)
              showRemoteVideo
                  ? AgoraVideoView(
                      controller: VideoViewController.remote(
                        rtcEngine: engine,
                        canvas: VideoCanvas(
                          uid: _remoteUid,
                          sourceType: VideoSourceType.videoSourceRemote,
                        ),
                        connection: RtcConnection(
                          channelId: widget.channelName,
                          localUid: local,
                        ),
                      ),
                    )
                  : Container(
                      color: Colors.black,
                      alignment: Alignment.center,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.videocam_outlined,
                              size: 48, color: Colors.white24),
                          const SizedBox(height: 12),
                          Text(
                            widget.iAmCaller && _remoteUid == null
                                ? 'Calling ${widget.peerName}…'
                                : 'Waiting for video…',
                            style: GoogleFonts.outfit(color: Colors.white70),
                          ),
                        ],
                      ),
                    )
            else if (!widget.video)
              _AudioPulseLayer(
                pulse: _pulse,
                peerName: widget.peerName,
                myLabel: widget.localDisplayName.isNotEmpty
                    ? widget.localDisplayName
                    : 'You',
              )
            else
              const SizedBox.shrink(),
            if (widget.video && engine != null && !_busy)
              Positioned(
                right: 0,
                top: 0,
                child: Transform.translate(
                  offset: _pipOffset,
                  child: GestureDetector(
                    onPanUpdate: (details) {
                      setState(() {
                        _pipOffset += details.delta;
                      });
                    },
                    child: Material(
                      elevation: 6,
                      borderRadius: BorderRadius.circular(12),
                      clipBehavior: Clip.antiAlias,
                      child: SizedBox(
                        width: 108,
                        height: 152,
                        child: AgoraVideoView(
                          controller: VideoViewController(
                            rtcEngine: engine,
                            canvas: const VideoCanvas(
                              uid: 0,
                              sourceType: VideoSourceType.videoSourceCamera,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.65),
                      Colors.transparent,
                    ],
                  ),
                ),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: () => unawaited(_cleanup(remoteEnded: false)),
                      icon: const Icon(Icons.arrow_back_ios_new_rounded,
                          color: Colors.white, size: 20),
                    ),
                    Expanded(
                      child: Text(
                        widget.peerName,
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 28,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _CallControl(
                    icon: _muted ? Icons.mic_off_rounded : Icons.mic_rounded,
                    label: 'Mute',
                    onTap: _toggleMute,
                  ),
                  const SizedBox(width: 20),
                  if (widget.video)
                    _CallControl(
                      icon: Icons.cameraswitch_rounded,
                      label: 'Flip',
                      onTap: _flipCamera,
                    ),
                  if (widget.video) const SizedBox(width: 20),
                  _CallControl(
                    icon: Icons.call_end_rounded,
                    label: 'End',
                    filled: true,
                    onTap: () => unawaited(_cleanup(remoteEnded: false)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CallControl extends StatelessWidget {
  const _CallControl({
    required this.icon,
    required this.label,
    required this.onTap,
    this.filled = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  static const Color _brown = Color(AppConstants.primaryColor);

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: filled ? Colors.red.shade700 : _brown.withValues(alpha: 0.9),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Icon(icon, color: Colors.white, size: 26),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: GoogleFonts.outfit(color: Colors.white70, fontSize: 12),
        ),
      ],
    );
  }
}

class _AudioPulseLayer extends StatelessWidget {
  const _AudioPulseLayer({
    required this.pulse,
    required this.peerName,
    required this.myLabel,
  });

  final AnimationController pulse;
  final String peerName;
  final String myLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black,
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _PulsingAvatar(label: myLabel, pulse: pulse, delay: 0),
              const SizedBox(width: 40),
              _PulsingAvatar(label: peerName, pulse: pulse, delay: 0.35),
            ],
          ),
          const SizedBox(height: 28),
          Text(
            'Voice call',
            style: GoogleFonts.outfit(
              color: Colors.white70,
              fontSize: 15,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _PulsingAvatar extends StatelessWidget {
  const _PulsingAvatar({
    required this.label,
    required this.pulse,
    required this.delay,
  });

  final String label;
  final AnimationController pulse;
  final double delay;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pulse,
      builder: (context, child) {
        final t = (pulse.value + delay) % 1.0;
        final scale = 1.0 + 0.12 * (0.5 - (t - 0.5).abs()) * 2;
        return Transform.scale(
          scale: scale,
          child: child,
        );
      },
      child: Column(
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: const Color(AppConstants.primaryColor).withValues(alpha: 0.85),
                width: 3,
              ),
              color: Colors.white.withValues(alpha: 0.08),
            ),
            alignment: Alignment.center,
            child: Text(
              label.isNotEmpty ? label[0].toUpperCase() : '?',
              style: GoogleFonts.outfit(
                fontSize: 36,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: 120,
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(color: Colors.white70, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
