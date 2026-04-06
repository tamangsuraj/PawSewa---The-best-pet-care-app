import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/api_client.dart';
import '../../core/constants.dart';

class RateFeedbackScreen extends StatefulWidget {
  const RateFeedbackScreen({super.key});

  @override
  State<RateFeedbackScreen> createState() => _RateFeedbackScreenState();
}

class _RateFeedbackScreenState extends State<RateFeedbackScreen> {
  final _api = ApiClient();
  final _controller = TextEditingController();

  int _rating = 5;
  bool _sending = false;
  String? _error;
  bool _sent = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    setState(() {
      _sending = true;
      _error = null;
      _sent = false;
    });
    try {
      final mine = await _api.getCustomerCareMine();
      final body = mine.data;
      final data = (body is Map && body['success'] == true) ? body['data'] : null;
      final convId = (data is Map ? data['_id'] : null)?.toString();
      if (convId == null || convId.isEmpty) {
        throw Exception('Support chat not available');
      }

      final payload = StringBuffer()
        ..writeln('[APP RATING]')
        ..writeln('Rating: $_rating/5')
        ..writeln('Message: ${text.isEmpty ? '(no comment)' : text}');

      await _api.postCustomerCareMessage(convId, payload.toString());
      if (!mounted) return;
      setState(() {
        _sent = true;
        _sending = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.response?.data is Map
            ? (e.response!.data as Map)['message']?.toString() ?? e.message
            : e.message;
        _sending = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _sending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    const brown = Color(AppConstants.primaryColor);
    const cream = Color(AppConstants.secondaryColor);
    final ink = Colors.grey.shade900;

    return Scaffold(
      backgroundColor: cream,
      appBar: AppBar(
        backgroundColor: brown,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Rate & Feedback',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: brown.withValues(alpha: 0.10)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'How was your experience?',
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: ink,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: List.generate(5, (i) {
                    final v = i + 1;
                    final active = v <= _rating;
                    return IconButton(
                      onPressed: _sending ? null : () => setState(() => _rating = v),
                      icon: Icon(
                        active ? Icons.star_rounded : Icons.star_outline_rounded,
                        color: active ? const Color(0xFFF5B301) : Colors.grey.shade400,
                        size: 30,
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 6),
                Text(
                  'Tell us what we can improve (optional)',
                  style: GoogleFonts.outfit(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _controller,
                  enabled: !_sending,
                  maxLines: 4,
                  decoration: InputDecoration(
                    hintText: 'Example: Shop loading is slow on mobile data…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Text(
                      _error!,
                      style: GoogleFonts.outfit(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.red.shade800,
                      ),
                    ),
                  ),
                ],
                if (_sent) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF34D399)),
                    ),
                    child: Text(
                      'Thanks — sent to Customer Care.',
                      style: GoogleFonts.outfit(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF065F46),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _sending ? null : _submit,
                    style: FilledButton.styleFrom(backgroundColor: brown),
                    icon: _sending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.send_rounded, color: Colors.white),
                    label: Text(
                      _sending ? 'Sending…' : 'Send feedback',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

