import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import '../widgets/partner_scaffold.dart';

class RiderProofOfDeliveryScreen extends StatefulWidget {
  const RiderProofOfDeliveryScreen({super.key, required this.order});

  final Map<String, dynamic> order;

  @override
  State<RiderProofOfDeliveryScreen> createState() => _RiderProofOfDeliveryScreenState();
}

class _RiderProofOfDeliveryScreenState extends State<RiderProofOfDeliveryScreen> {
  final _api = ApiClient();
  final _picker = ImagePicker();

  final _otpCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  bool _submitting = false;
  int? _uploadPct;
  String? _photoUrl;

  @override
  void dispose() {
    _otpCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  String _orderId() => widget.order['_id']?.toString() ?? '';

  String _customerName() {
    final u = widget.order['user'];
    if (u is Map) return u['name']?.toString() ?? 'Customer';
    return 'Customer';
  }

  Future<void> _pickAndUploadPhoto() async {
    try {
      final XFile? file = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final name = file.name.trim().isNotEmpty ? file.name : 'delivery.jpg';
      final filename = name.contains('.') ? name : '$name.jpg';

      if (!mounted) return;
      setState(() => _uploadPct = 0);

      final resp = await _api.uploadChatMedia(
        bytes,
        filename: filename,
        onSendProgress: (sent, total) {
          if (total <= 0) return;
          final pct = ((sent / total) * 100).clamp(0, 100).round();
          if (mounted) setState(() => _uploadPct = pct);
        },
      );
      final body = resp.data;
      String url = '';
      if (body is Map && body['success'] == true && body['data'] is Map) {
        url = (body['data'] as Map)['url']?.toString() ?? '';
      }
      if (!mounted) return;
      setState(() {
        _photoUrl = url.trim().isEmpty ? null : url.trim();
        _uploadPct = null;
      });
      if (_photoUrl == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Upload failed — no URL returned')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Delivery photo uploaded')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploadPct = null);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Photo upload failed: $e')),
      );
    }
  }

  Future<void> _submit() async {
    final orderId = _orderId();
    if (orderId.isEmpty) return;

    final otp = _otpCtrl.text.trim();
    final notes = _notesCtrl.text.trim();

    if ((otp.isEmpty) && (_photoUrl == null || _photoUrl!.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add OTP or a delivery photo')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await _api.deliverOrderWithProof(
        orderId: orderId,
        otp: otp.isEmpty ? null : otp,
        photoUrl: _photoUrl,
        notes: notes.isEmpty ? null : notes,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Delivered with proof'), backgroundColor: Colors.green),
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to deliver: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final ink = const Color(AppConstants.inkColor);
    return PartnerScaffold(
      title: 'Proof of delivery',
      subtitle: _customerName(),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Add at least one proof method',
                  style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: ink),
                ),
                const SizedBox(height: 6),
                Text(
                  'Use OTP when available, or capture a delivery photo at the door. This protects you and the customer.',
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.w500,
                    color: ink.withValues(alpha: 0.65),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('OTP (optional)', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: ink)),
                const SizedBox(height: 10),
                TextField(
                  controller: _otpCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    hintText: 'Enter 4–6 digit OTP',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Delivery photo (optional)', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: ink)),
                const SizedBox(height: 10),
                if (_uploadPct != null) ...[
                  LinearProgressIndicator(
                    value: (_uploadPct! / 100).clamp(0, 1),
                    color: primary,
                    backgroundColor: primary.withValues(alpha: 0.10),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Uploading… $_uploadPct%',
                    style: GoogleFonts.outfit(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: ink.withValues(alpha: 0.65),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                Row(
                  children: [
                    OutlinedButton.icon(
                      onPressed: (_uploadPct != null || _submitting) ? null : _pickAndUploadPhoto,
                      icon: const Icon(Icons.camera_alt_rounded),
                      label: Text('Capture photo', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                    ),
                    const SizedBox(width: 10),
                    if (_photoUrl != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(AppConstants.sandColor).withValues(alpha: 0.95),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: primary.withValues(alpha: 0.10)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle_rounded, color: primary, size: 18),
                            const SizedBox(width: 8),
                            Text('Uploaded', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: ink)),
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: () => setState(() => _photoUrl = null),
                              child: Icon(Icons.close_rounded, color: ink.withValues(alpha: 0.55), size: 18),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: primary.withValues(alpha: 0.10)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Notes (optional)', style: GoogleFonts.outfit(fontWeight: FontWeight.w800, color: ink)),
                const SizedBox(height: 10),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'e.g., left at reception, customer requested…',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            style: FilledButton.styleFrom(backgroundColor: primary, padding: const EdgeInsets.symmetric(vertical: 14)),
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : Text('Confirm delivered', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

