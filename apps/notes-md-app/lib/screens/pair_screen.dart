import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class PairScreen extends StatefulWidget {
  const PairScreen({super.key});

  @override
  State<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends State<PairScreen> {
  bool _pairing = false;
  String? _error;
  MobileScannerController? _scannerController;

  @override
  void initState() {
    super.initState();
    _scannerController = MobileScannerController();
  }

  @override
  void dispose() {
    _scannerController?.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_pairing) return;
    final barcode = capture.barcodes.firstOrNull;
    final rawValue = barcode?.rawValue;
    if (rawValue == null || rawValue.isEmpty) return;

    setState(() => _pairing = true);
    _scannerController?.stop();

    // Try to parse as JSON QR code (notes.md format)
    String pairingToken;
    try {
      final data = jsonDecode(rawValue);
      if (data is Map && data['type'] == 'notesmd_pair') {
        pairingToken = data['token'] as String;
        // Also update server URL if present
        if (data['server'] != null) {
          context.read<AuthService>().setServer(data['server'] as String);
        }
      } else {
        throw const FormatException('Unknown QR format');
      }
    } catch (_) {
      // Fallback: treat raw value as the pairing token itself
      pairingToken = rawValue;
    }

    _claim(pairingToken);
  }

  Future<void> _claim(String pairingToken) async {
    final auth = context.read<AuthService>();
    final success = await auth.claimPairing(pairingToken);
    if (!mounted) return;

    if (success) {
      Navigator.of(context).pushReplacementNamed('/home');
    } else {
      setState(() {
        _error = 'Pairing failed. Make sure the server is running '
            'and the QR code is still valid.';
        _pairing = false;
      });
      _scannerController?.start();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pair with Web'),
        centerTitle: true,
      ),
      body: Column(
        children: [
          if (_error != null)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: theme.colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline,
                      color: theme.colorScheme.onErrorContainer, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: TextStyle(
                          color: theme.colorScheme.onErrorContainer,
                          fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          Expanded(
            child: _pairing
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(
                            color: theme.colorScheme.primary),
                        const SizedBox(height: 24),
                        Text(
                          'Pairing device...',
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Please wait while we connect',
                          style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                  )
                : MobileScanner(
                    controller: _scannerController,
                    onDetect: _onDetect,
                    fit: BoxFit.cover,
                    overlayBuilder: (context, constraints) {
                      return Stack(
                        children: [
                          Center(
                            child: Container(
                              width: 250,
                              height: 250,
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: theme.colorScheme.primary,
                                  width: 3,
                                ),
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
          ),

          // Bottom info
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
            ),
            child: Column(
              children: [
                Icon(Icons.qr_code_scanner,
                    color: theme.colorScheme.primary, size: 28),
                const SizedBox(height: 12),
                Text(
                  'Open notes.md on your computer,\n'
                  'go to "Pair Device" and scan the QR code.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: theme.colorScheme.onSurfaceVariant,
                    fontSize: 14,
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
