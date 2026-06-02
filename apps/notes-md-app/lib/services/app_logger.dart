import 'package:flutter/foundation.dart';

/// Simple in-app logger that keeps a running log of events and errors.
class AppLogger {
  static final AppLogger _instance = AppLogger._();
  factory AppLogger() => _instance;
  AppLogger._();

  final List<LogEntry> _entries = [];
  int _nextId = 0;
  static const int _maxEntries = 500;

  List<LogEntry> get entries => List.unmodifiable(_entries);

  void info(String message) => _add(LogLevel.info, message);
  void debug(String message) => _add(LogLevel.info, '[debug] $message');
  void warn(String message) => _add(LogLevel.warning, message);
  void error(String message, [dynamic error, StackTrace? stack]) {
    String full = message;
    if (error != null) full += '\n$error';
    if (stack != null) full += '\n${stack.toString().split('\n').take(4).join('\n')}';
    _add(LogLevel.error, full);
    debugPrint('[notes.md ERROR] $full');
  }

  // Static helpers with tag prefix
  static void d(String tag, String message) => _instance.debug('$tag: $message');
  static void i(String tag, String message) => _instance.info('$tag: $message');
  static void w(String tag, String message) => _instance.warn('$tag: $message');
  static void e(String tag, String message, [dynamic error, StackTrace? stack]) =>
      _instance.error('$tag: $message', error, stack);

  void _add(LogLevel level, String message) {
    _entries.add(LogEntry(
      id: _nextId++,
      timestamp: DateTime.now(),
      level: level,
      message: message,
    ));
    if (_entries.length > _maxEntries) {
      _entries.removeAt(0);
    }
  }

  void clear() => _entries.clear();
}

enum LogLevel { info, warning, error }

class LogEntry {
  final int id;
  final DateTime timestamp;
  final LogLevel level;
  final String message;

  LogEntry({
    required this.id,
    required this.timestamp,
    required this.level,
    required this.message,
  });

  String get formattedTime {
    final h = timestamp.hour.toString().padLeft(2, '0');
    final m = timestamp.minute.toString().padLeft(2, '0');
    final s = timestamp.second.toString().padLeft(2, '0');
    return '$h:$m:$s';
  }
}
