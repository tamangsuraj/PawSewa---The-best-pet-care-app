import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../core/api_client.dart';
import '../core/constants.dart';
import 'subscription_payment_screen.dart';

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key});

  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiClient();
  late TabController _tabs;
  List<dynamic> _plans = [];
  Map<String, dynamic>? _mySub;
  bool _loading = true;
  String? _error;

  static const _kBrown = Color(AppConstants.primaryColor);
  static const _kInk = Color(AppConstants.inkColor);
  static const _kTeal = Color(AppConstants.accentColor);
  static const _kCream = Color(AppConstants.secondaryColor);

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plansRes = await _api.getSubscriptionPlans();
      final myRes = await _api.getMySubscription();
      if (!mounted) return;
      setState(() {
        _plans = plansRes;
        final data = myRes['data'];
        _mySub = data is Map ? Map<String, dynamic>.from(data) : null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      String msg = 'Could not load subscription data.';
      if (e is DioException) {
        final d = e.response?.data;
        if (d is Map && d['message'] != null) {
          msg = d['message'].toString();
        } else if (e.type == DioExceptionType.connectionError) {
          msg = 'No connection. Check your internet and try again.';
        }
      }
      setState(() {
        _error = msg;
        _loading = false;
      });
    }
  }

  Future<void> _openPayment(Map<String, dynamic> plan) async {
    final id = (plan['_id'] ?? plan['id'])?.toString() ?? '';
    if (id.isEmpty) return;
    final activated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => SubscriptionPaymentScreen(
          planId: id,
          planName: plan['name']?.toString() ?? 'Plan',
          price: (plan['price'] as num?) ?? 0,
          cycle: plan['cycle']?.toString() ?? '',
        ),
      ),
    );
    if (activated == true && mounted) {
      await _load();
      if (mounted) _tabs.animateTo(1);
    }
  }

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Text(
          'Cancel plan?',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700),
        ),
        content: Text(
          'You will keep access until the end of your billing period.',
          style: GoogleFonts.outfit(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Keep', style: GoogleFonts.outfit()),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red.shade700),
            child: Text('Cancel plan', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      final res = await _api.cancelSubscription();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['message']?.toString() ?? 'Subscription cancelling')),
      );
      await _load();
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.response?.data?['message']?.toString() ?? 'Cancel failed')),
      );
    }
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'pending_payment':
        return 'Awaiting payment verification';
      case 'active':
        return 'Active';
      case 'cancelling':
        return 'Cancelling (ends at billing period end)';
      default:
        return status ?? '—';
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'active':
        return Colors.green.shade700;
      case 'cancelling':
        return Colors.orange.shade700;
      case 'pending_payment':
        return Colors.blue.shade700;
      default:
        return Colors.grey.shade600;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kCream,
      appBar: AppBar(
        backgroundColor: _kBrown,
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'PawSewa Pro',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w700, color: Colors.white),
        ),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          labelStyle: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600),
          unselectedLabelStyle: GoogleFonts.outfit(fontSize: 13),
          tabs: const [Tab(text: 'Plans'), Tab(text: 'My Subscription')],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorState()
              : TabBarView(
                  controller: _tabs,
                  children: [_buildPlansTab(), _buildMySubTab()],
                ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              'Could not load',
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _kInk,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade700),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _load,
              style: FilledButton.styleFrom(backgroundColor: _kBrown),
              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              label: Text('Retry', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlansTab() {
    if (_plans.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.star_outline_rounded, size: 64, color: _kBrown.withValues(alpha: 0.4)),
              const SizedBox(height: 16),
              Text(
                'No plans available',
                style: GoogleFonts.outfit(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: _kInk,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Check back soon for PawSewa Pro plans.',
                style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade600),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }
    return RefreshIndicator(
      color: _kBrown,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        itemCount: _plans.length,
        itemBuilder: (ctx, i) {
          final p = _plans[i] as Map<String, dynamic>;
          return _PlanCard(
            plan: p,
            isCurrentPlan: _mySub != null && _mySub!['status'] == 'active',
            onSubscribe: () => _openPayment(p),
          );
        },
      ),
    );
  }

  Widget _buildMySubTab() {
    if (_mySub == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: _kBrown.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.star_outline_rounded, size: 40, color: _kBrown),
              ),
              const SizedBox(height: 20),
              Text(
                'No active subscription',
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: _kInk,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Upgrade to PawSewa Pro to unlock priority access, discounts, and premium care.',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey.shade600, height: 1.4),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => _tabs.animateTo(0),
                style: FilledButton.styleFrom(
                  backgroundColor: _kTeal,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 28),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  textStyle: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
                ),
                child: const Text('View Plans'),
              ),
            ],
          ),
        ),
      );
    }

    final status = _mySub!['status']?.toString();
    final statusColor = _statusColor(status);

    return RefreshIndicator(
      color: _kBrown,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _kBrown.withValues(alpha: 0.12)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 12,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: _kBrown.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(Icons.star_rounded, color: _kBrown, size: 26),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _mySub!['plan']?.toString() ?? 'Pro Plan',
                            style: GoogleFonts.fraunces(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: _kBrown,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                            decoration: BoxDecoration(
                              color: statusColor.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              _statusLabel(status),
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: statusColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (_mySub!['paymentMethod'] != null) ...[
                  const SizedBox(height: 16),
                  _subDetailRow('Payment', _mySub!['paymentMethod'].toString()),
                ],
                if (_mySub!['paymentRef'] != null) ...[
                  const SizedBox(height: 8),
                  _subDetailRow('Reference', _mySub!['paymentRef'].toString()),
                ],
                if (status == 'pending_payment') ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline_rounded, color: Colors.blue.shade700, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'We are verifying your Fonepay payment. Open Customer Care if you have already paid.',
                            style: GoogleFonts.outfit(fontSize: 12.5, color: Colors.blue.shade800),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_mySub!['startDate'] != null && status != 'pending_payment') ...[
                  const SizedBox(height: 8),
                  _subDetailRow(
                    'Start date',
                    DateFormat.yMMMd().format(DateTime.parse(_mySub!['startDate'].toString())),
                  ),
                ],
                if (_mySub!['endDate'] != null && status != 'pending_payment') ...[
                  const SizedBox(height: 8),
                  _subDetailRow(
                    'End date',
                    DateFormat.yMMMd().format(DateTime.parse(_mySub!['endDate'].toString())),
                  ),
                ],
                if (status == 'active') ...[
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _cancel,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red.shade700,
                        side: BorderSide(color: Colors.red.shade300),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: Text(
                        'Cancel Plan',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _subDetailRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 100,
          child: Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _kInk.withValues(alpha: 0.55),
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: GoogleFonts.outfit(fontSize: 13, color: _kInk),
          ),
        ),
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.isCurrentPlan,
    required this.onSubscribe,
  });

  final Map<String, dynamic> plan;
  final bool isCurrentPlan;
  final VoidCallback onSubscribe;

  static const _kBrown = Color(AppConstants.primaryColor);
  static const _kInk = Color(AppConstants.inkColor);
  static const _kTeal = Color(AppConstants.accentColor);

  @override
  Widget build(BuildContext context) {
    final name = plan['name']?.toString() ?? 'Plan';
    final price = plan['price'];
    final cycle = plan['cycle']?.toString() ?? '';
    final services = (plan['services'] as List?)?.cast<String>() ?? [];

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _kBrown.withValues(alpha: 0.16)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _kBrown.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.star_rounded, color: _kBrown, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: GoogleFonts.fraunces(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: _kBrown,
                      ),
                    ),
                    Text(
                      'NPR ${price ?? '—'} / ${cycle.isEmpty ? 'month' : cycle}',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: _kInk.withValues(alpha: 0.75),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (services.isNotEmpty) ...[
            const SizedBox(height: 14),
            ...services.map(
              (s) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 18,
                      height: 18,
                      margin: const EdgeInsets.only(top: 1, right: 10),
                      decoration: BoxDecoration(color: _kTeal, shape: BoxShape.circle),
                      child: const Icon(Icons.check_rounded, color: Colors.white, size: 12),
                    ),
                    Expanded(
                      child: Text(s, style: GoogleFonts.outfit(fontSize: 13.5, color: _kInk)),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: isCurrentPlan ? null : onSubscribe,
              style: FilledButton.styleFrom(
                backgroundColor: _kBrown,
                disabledBackgroundColor: Colors.grey.shade300,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                textStyle: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
              ),
              child: Text(isCurrentPlan ? 'Current plan' : 'Subscribe'),
            ),
          ),
        ],
      ),
    );
  }
}
