import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/server_config_service.dart';

/// A dialog for configuring the optional server connection.
/// App works fully offline by default.
class SettingsDialog extends StatefulWidget {
  const SettingsDialog({super.key});

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  late TextEditingController _urlController;

  @override
  void initState() {
    super.initState();
    final config = context.read<ServerConfigService>();
    _urlController = TextEditingController(text: config.serverUrl ?? '');
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final config = context.watch<ServerConfigService>();
    final theme = Theme.of(context);

    return AlertDialog(
      title: Row(
        children: [
          Icon(Icons.settings, color: theme.colorScheme.primary),
          const SizedBox(width: 8),
          const Text('Settings'),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // --- Server configuration ---
            Text(
              'Server Connection (Optional)',
              style: theme.textTheme.titleSmall?.copyWith(
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Leave empty for fully offline mode. '
              'Enter a server URL to enable sync and pairing.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _urlController,
              decoration: InputDecoration(
                labelText: 'Server URL',
                hintText: 'http://192.168.1.14:8000',
                border: const OutlineInputBorder(),
                prefixIcon: const Icon(Icons.dns_outlined),
                suffixIcon: _urlController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _urlController.clear();
                          config.setServerUrl(null);
                        },
                      )
                    : null,
              ),
              keyboardType: TextInputType.url,
              autocorrect: false,
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),

            // --- Connection status ---
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: config.hasServer
                    ? Colors.green.withAlpha(25)
                    : theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(
                    config.hasServer
                        ? Icons.cloud_outlined
                        : Icons.cloud_off_outlined,
                    size: 18,
                    color: config.hasServer ? Colors.green : Colors.grey,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    config.hasServer
                        ? 'Server configured: ${config.serverUrl}'
                        : 'Fully offline mode',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),

            // --- Sync toggle (only if server is configured) ---
            if (config.hasServer) ...[
              const SizedBox(height: 12),
              SwitchListTile(
                title: const Text('Enable Sync'),
                subtitle: const Text('Sync notes with the server'),
                value: config.syncEnabled,
                onChanged: (v) => config.setSyncEnabled(v),
                contentPadding: EdgeInsets.zero,
                dense: true,
              ),
            ],

            const Divider(height: 24),

            // --- About ---
            Text(
              'About',
              style: theme.textTheme.titleSmall?.copyWith(
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'notes.md v0.1.0-alpha\n'
              'Offline-first markdown editor.\n'
              'No cloud, no telemetry, no accounts required.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          icon: const Icon(Icons.save, size: 18),
          label: const Text('Save'),
          onPressed: () async {
            final url = _urlController.text.trim();
            await config.setServerUrl(url.isNotEmpty ? url : null);
            if (context.mounted) Navigator.of(context).pop();
          },
        ),
      ],
    );
  }
}

/// Shows the settings dialog.
Future<void> showSettingsDialog(BuildContext context) {
  return showDialog(
    context: context,
    builder: (_) => const SettingsDialog(),
  );
}
