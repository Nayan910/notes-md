import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService extends ChangeNotifier {
  static const _storage = FlutterSecureStorage();
  static const _tokenKey = 'notesmd_token';
  static const _userKey = 'notesmd_user';
  static const _serverKey = 'notesmd_server';

  String? _token;
  Map<String, dynamic>? _user;
  String _server = 'http://192.168.1.100:8000';
  bool _loading = true;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  String get server => _server;
  bool get isAuthenticated => _token != null;
  bool get isLoading => _loading;

  /// Load saved session from secure storage.
  Future<void> load() async {
    try {
      _token = await _storage.read(key: _tokenKey);
      final userStr = await _storage.read(key: _userKey);
      final serverStr = await _storage.read(key: _serverKey);
      if (userStr != null) _user = jsonDecode(userStr);
      if (serverStr != null) _server = serverStr;
    } catch (e) {
      debugPrint('AuthService.load error: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Claim a pairing token by sending it to the server.
  /// Returns true on success.
  Future<bool> claimPairing(String pairingToken) async {
    try {
      final res = await http.post(
        Uri.parse('$_server/pair/claim'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'pairing_token': pairingToken,
          'device_name': 'Android Phone',
        }),
      );
      if (res.statusCode != 200) return false;

      final data = jsonDecode(res.body);
      _token = data['token'];
      _user = data['user'];

      await _storage.write(key: _tokenKey, value: _token);
      await _storage.write(key: _userKey, value: jsonEncode(_user));
      await _storage.write(key: _serverKey, value: _server);

      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('claimPairing error: $e');
      return false;
    }
  }

  /// Set the server URL.
  Future<void> setServer(String url) async {
    _server = url;
    await _storage.write(key: _serverKey, value: url);
    notifyListeners();
  }

  /// Logout: clear stored credentials.
  Future<void> logout() async {
    _token = null;
    _user = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
    notifyListeners();
  }
}
