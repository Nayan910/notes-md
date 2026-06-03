import 'package:flutter/foundation.dart';
import 'package:bonsoir/bonsoir.dart';
import 'app_logger.dart';

/// mDNS discovery service for finding notes.md servers on the LAN.
///
/// Scans for `_notesmd._tcp` services advertised by the FastAPI backend.
/// Returns discovered server URLs that the user can select in Settings.
///
/// Falls back gracefully on platforms where mDNS is unavailable (e.g. some
/// Android WebView configurations or Windows without Bonjour service).
class DiscoveryService {
  BonsoirDiscovery? _discovery;
  bool _isScanning = false;

  /// Whether a scan is currently in progress.
  bool get isScanning => _isScanning;

  /// Start scanning for notes.md servers on the LAN.
  ///
  /// Calls [onDiscovered] with each server URL found.
  /// Calls [onDone] when the scan completes.
  Future<void> startScanning({
    required void Function(String url) onDiscovered,
    VoidCallback? onDone,
  }) async {
    if (_isScanning) return;

    try {
      const serviceType = '_notesmd._tcp';
      _discovery = BonsoirDiscovery(type: serviceType);
      _isScanning = true;

      _discovery!.eventStream!.listen((event) {
        if (event.type == BonsoirDiscoveryEventType.discoveryServiceFound) {
          final service = event.service!;
          // Extract IP and port from the discovered service
          final host = service.host?.trim() ?? 'localhost';
          final port = service.port ?? 8000;
          final url = 'http://$host:$port';
          AppLogger.d('DiscoveryService', 'Found server: $url');
          onDiscovered(url);
        }
      });

      await _discovery!.start();
      AppLogger.i('DiscoveryService', 'Scanning for notes.md servers…');
    } catch (e) {
      AppLogger.w('DiscoveryService', 'mDNS scan failed: $e');
      _isScanning = false;
    }
  }

  /// Stop scanning.
  Future<void> stopScanning() async {
    if (!_isScanning || _discovery == null) return;

    try {
      await _discovery!.stop();
    } catch (e) {
      AppLogger.d('DiscoveryService', 'Stop error: $e');
    } finally {
      _isScanning = false;
      _discovery = null;
    }
  }

  /// Clean up resources.
  Future<void> dispose() async {
    await stopScanning();
  }
}
