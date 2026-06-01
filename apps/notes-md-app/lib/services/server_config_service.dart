import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Manages the optional server URL configuration.
/// The app works fully offline by default.
/// If a server URL is configured, sync/pairing features become available.
class ServerConfigService extends ChangeNotifier {
  static const _storage = FlutterSecureStorage();
  static const _serverUrlKey = 'notesmd_server_url';
  static const _syncEnabledKey = 'notesmd_sync_enabled';

  String? _serverUrl;
  bool _syncEnabled = false;
  bool _loading = true;

  String? get serverUrl => _serverUrl;
  bool get syncEnabled => _syncEnabled;
  bool get isLoading => _loading;
  bool get hasServer => _serverUrl != null && _serverUrl!.isNotEmpty;

  /// Load saved config from secure storage.
  Future<void> load() async {
    try {
      _serverUrl = await _storage.read(key: _serverUrlKey);
      final syncStr = await _storage.read(key: _syncEnabledKey);
      _syncEnabled = syncStr == 'true';
    } catch (e) {
      debugPrint('ServerConfigService.load error: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Set the server URL (e.g. "http://192.168.1.14:8000").
  /// Pass null or empty to disable server connection.
  Future<void> setServerUrl(String? url) async {
    _serverUrl = (url != null && url.trim().isNotEmpty) ? url.trim() : null;
    if (_serverUrl != null) {
      await _storage.write(key: _serverUrlKey, value: _serverUrl);
    } else {
      await _storage.delete(key: _serverUrlKey);
      _syncEnabled = false;
    }
    notifyListeners();
  }

  /// Toggle sync on/off.
  Future<void> setSyncEnabled(bool enabled) async {
    _syncEnabled = enabled && hasServer;
    await _storage.write(
      key: _syncEnabledKey,
      value: _syncEnabled.toString(),
    );
    notifyListeners();
  }

  /// Clear all server config (go fully offline).
  Future<void> clear() async {
    _serverUrl = null;
    _syncEnabled = false;
    await _storage.delete(key: _serverUrlKey);
    await _storage.delete(key: _syncEnabledKey);
    notifyListeners();
  }
}
