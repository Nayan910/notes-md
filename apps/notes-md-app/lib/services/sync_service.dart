import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'app_logger.dart';
import 'file_service.dart';
import 'server_config_service.dart';

/// Sync status for UI display.
enum SyncStatus {
  /// Sync is idle (no server configured, or waiting for next cycle).
  idle,

  /// Sync is in progress.
  syncing,

  /// Last sync completed successfully.
  success,

  /// Last sync failed.
  error,

  /// Server is not configured.
  offline,
}

/// File-level LWW sync service for notes.md.
///
/// Runs a 30-second background sync loop when:
/// 1. A server URL is configured (via [ServerConfigService])
/// 2. Sync is enabled in settings
///
/// Uses the FastAPI backend endpoints:
/// - `POST /sync/diff` — compare local vs server state
/// - `POST /sync/upload` — upload newer local files
/// - `GET /sync/file/{path}` — download newer remote files
class SyncService extends ChangeNotifier {
  static const _syncInterval = Duration(seconds: 30);
  static const _storage = FlutterSecureStorage();
  static const _syncTokenKey = 'notesmd_sync_token';

  final FileService _fileService;
  final ServerConfigService _serverConfig;

  Timer? _timer;
  SyncStatus _status = SyncStatus.offline;
  DateTime? _lastSyncTime;
  String? _errorMessage;
  String? _authToken;

  /// Current sync status.
  SyncStatus get status => _status;

  /// When the last sync completed (or null).
  DateTime? get lastSyncTime => _lastSyncTime;

  /// Error message from last failed sync (or null).
  String? get errorMessage => _errorMessage;

  /// Whether the service is actively syncing.
  bool get isSyncing => _status == SyncStatus.syncing;

  /// Whether sync is available (server configured + token present).
  bool get isAvailable =>
      _serverConfig.hasServer &&
      _serverConfig.syncEnabled &&
      _authToken != null;

  SyncService({
    required FileService fileService,
    required ServerConfigService serverConfig,
  })  : _fileService = fileService,
        _serverConfig = serverConfig;

  /// Initialize: load saved token from secure storage.
  Future<void> init() async {
    try {
      _authToken = await _storage.read(key: _syncTokenKey);
    } catch (e) {
      AppLogger.w('SyncService', 'Failed to load token: $e');
    }
  }

  /// Start the background sync loop. Safe to call multiple times.
  void start() {
    if (_timer != null && _timer!.isActive) return;
    AppLogger.i('SyncService', 'Starting background sync (${_syncInterval.inSeconds}s interval)');
    _timer = Timer.periodic(_syncInterval, (_) => _sync());
    // Run first sync immediately
    _sync();
  }

  /// Stop the background sync loop.
  void stop() {
    _timer?.cancel();
    _timer = null;
    AppLogger.i('SyncService', 'Background sync stopped');
  }

  /// Trigger an immediate manual sync.
  Future<void> syncNow() => _sync();

  /// Save auth token for API calls.
  Future<void> setToken(String? token) async {
    _authToken = token;
    if (token != null) {
      await _storage.write(key: _syncTokenKey, value: token);
    } else {
      await _storage.delete(key: _syncTokenKey);
    }
    notifyListeners();
  }

  /// Clear auth token.
  Future<void> clearToken() async {
    _authToken = null;
    await _storage.delete(key: _syncTokenKey);
    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }

  // ── Internal sync logic ──────────────────────────────────────────────

  String get _baseUrl => _serverConfig.serverUrl ?? '';

  /// Main sync loop:
  /// 1. List local files
  /// 2. POST /sync/diff to compare
  /// 3. Upload newer local files
  /// 4. Download newer remote files
  Future<void> _sync() async {
    if (!isAvailable) {
      if (_status != SyncStatus.offline) {
        _status = SyncStatus.offline;
        notifyListeners();
      }
      return;
    }

    _status = SyncStatus.syncing;
    notifyListeners();

    try {
      await _doDiffSync();
      _status = SyncStatus.success;
      _lastSyncTime = DateTime.now();
      _errorMessage = null;
      AppLogger.i('SyncService', 'Sync completed successfully');
    } catch (e) {
      _status = SyncStatus.error;
      _errorMessage = e.toString();
      AppLogger.e('SyncService', 'Sync failed', e);
    }

    notifyListeners();
  }

  /// Execute the diff-based sync protocol.
  Future<void> _doDiffSync() async {
    // 1. Collect local file metadata
    final localFiles = await _fileService.listNotes();
    final localFilesPayload = localFiles
        .map((f) => {
              'path': f.path,
              'mtime': f.modified.toUtc().toIso8601String(),
              'hash': '', // Will compute on demand; server matches by mtime
            })
        .toList();

    // 2. Diff with server
    final diffResp = await http.post(
      Uri.parse('$_baseUrl/sync/diff'),
      headers: _headers,
      body: jsonEncode({'files': localFilesPayload}),
    );

    if (diffResp.statusCode == 401) {
      AppLogger.w('SyncService', 'Auth token expired — clearing');
      await clearToken();
      return;
    }

    if (diffResp.statusCode != 200) {
      throw HttpException(
        'Diff failed (${diffResp.statusCode}): ${diffResp.body}',
      );
    }

    final diff = jsonDecode(diffResp.body) as Map<String, dynamic>;

    // 3. Upload local files that are newer
    final localUploads = (diff['local_uploads'] as List?) ?? [];
    for (final item in localUploads) {
      final path = item['path'] as String;
      final mtime = item['mtime'] as String;
      await _uploadFile(path, mtime);
    }

    // 4. Download remote files that are newer
    final remoteUpdates = (diff['remote_updates'] as List?) ?? [];
    for (final item in remoteUpdates) {
      final path = item['path'] as String;
      await _downloadFile(path);
    }

    // 5. Log conflicts (no auto-resolution in v1 — LWW handles via mtime)
    final conflicts = (diff['conflicts'] as List?) ?? [];
    if (conflicts.isNotEmpty) {
      AppLogger.w('SyncService', '${conflicts.length} conflict(s) detected (same mtime, different content)');
      for (final conflict in conflicts) {
        AppLogger.w('SyncService', '  Conflict: ${conflict['path']}');
      }
    }
  }

  /// Upload a single file to the server.
  Future<void> _uploadFile(String path, String mtime) async {
    try {
      final content = await _fileService.readNote(path);
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_baseUrl/sync/upload'),
      );
      request.headers.addAll({'Authorization': 'Bearer $_authToken'});
      request.fields['mtime'] = mtime;
      request.files.add(http.MultipartFile.fromString(
        'file',
        content,
        filename: p.relative(path),
      ));

      final response = await request.send();
      if (response.statusCode == 409) {
        // LWW conflict — server has newer, skip upload
        AppLogger.d('SyncService', 'Server has newer version of $path — skipping upload');
      } else if (response.statusCode != 200) {
        AppLogger.w('SyncService', 'Upload failed for $path (${response.statusCode})');
      } else {
        AppLogger.d('SyncService', 'Uploaded $path');
      }
    } catch (e) {
      AppLogger.w('SyncService', 'Error uploading $path: $e');
    }
  }

  /// Download a single file from the server.
  Future<void> _downloadFile(String remotePath) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/sync/file/${Uri.encodeComponent(remotePath)}'),
        headers: _headers,
      );

      if (response.statusCode != 200) {
        AppLogger.w('SyncService', 'Download failed for $remotePath (${response.statusCode})');
        return;
      }

      // Determine local path — save under notes dir with same relative path
      final notesDir = await _fileService.getNotesDirectory();
      final localPath = p.join(notesDir.path, p.basename(remotePath));

      await _fileService.writeNote(localPath, response.body);
      AppLogger.d('SyncService', 'Downloaded $remotePath → $localPath');
    } catch (e) {
      AppLogger.w('SyncService', 'Error downloading $remotePath: $e');
    }
  }

  /// HTTP headers for API calls.
  Map<String, String> get _headers => {
        'Authorization': 'Bearer ${_authToken ?? ''}',
        'Content-Type': 'application/json',
      };
}
