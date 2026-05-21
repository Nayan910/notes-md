import 'package:flutter/material.dart';
import '../services/app_logger.dart';

class LogViewer extends StatefulWidget {
  const LogViewer({super.key});

  @override
  State<LogViewer> createState() => _LogViewerState();
}

class _LogViewerState extends State<LogViewer> {
  final AppLogger _log = AppLogger();
  final ScrollController _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Color _colorFor(LogLevel level) {
    switch (level) {
      case LogLevel.error: return Colors.redAccent;
      case LogLevel.warning: return Colors.orangeAccent;
      case LogLevel.info: return Colors.blueGrey;
    }
  }

  IconData _iconFor(LogLevel level) {
    switch (level) {
      case LogLevel.error: return Icons.error_outline;
      case LogLevel.warning: return Icons.warning_amber;
      case LogLevel.info: return Icons.info_outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    final entries = _log.entries;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
          child: Row(
            children: [
              const Text('App Log', style: TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              Text('${entries.length} entries', style: const TextStyle(fontSize: 12)),
              const SizedBox(width: 8),
              TextButton.icon(
                onPressed: () { setState(() => _log.clear()); },
                icon: const Icon(Icons.delete_sweep, size: 16),
                label: const Text('Clear', style: TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: entries.isEmpty
              ? const Center(child: Text('No log entries', style: TextStyle(color: Colors.grey)))
              : ListView.builder(
                  controller: _scroll,
                  itemCount: entries.length,
                  itemBuilder: (context, i) {
                    final e = entries[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 1),
                      child: InkWell(
                        onTap: () => _showDetail(context, e),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(e.formattedTime, style: const TextStyle(fontSize: 11, color: Colors.grey, fontFamily: 'monospace')),
                            const SizedBox(width: 4),
                            Icon(_iconFor(e.level), size: 14, color: _colorFor(e.level)),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                e.message.contains('\n') ? '${e.message.split('\n').first}…' : e.message,
                                style: TextStyle(fontSize: 12, color: _colorFor(e.level)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  void _showDetail(BuildContext context, LogEntry entry) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${entry.level.name} — ${entry.formattedTime}'),
        content: SingleChildScrollView(
          child: SelectableText(entry.message, style: const TextStyle(fontSize: 13, fontFamily: 'monospace')),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
      ),
    );
  }
}
