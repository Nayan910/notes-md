import 'package:flutter/material.dart';

class NotesMdToolbar extends StatelessWidget {
  final VoidCallback onNewDoc;
  final VoidCallback onOpenFile;
  final VoidCallback onSaveFile;

  const NotesMdToolbar({
    super.key,
    required this.onNewDoc,
    required this.onOpenFile,
    required this.onSaveFile,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        border: Border(
          bottom: BorderSide(color: colorScheme.outlineVariant, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          const SizedBox(width: 8),
          // App title
          Text(
            'notes.md',
            style: TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: colorScheme.onSurface,
            ),
          ),
          const Spacer(),
          // Toolbar buttons
          _ToolbarButton(
            icon: Icons.note_add_outlined,
            tooltip: 'New document',
            onPressed: onNewDoc,
          ),
          _ToolbarButton(
            icon: Icons.folder_open_outlined,
            tooltip: 'Open markdown file',
            onPressed: onOpenFile,
          ),
          _ToolbarButton(
            icon: Icons.save_outlined,
            tooltip: 'Save as markdown',
            onPressed: onSaveFile,
          ),
          const SizedBox(width: 4),
        ],
      ),
    );
  }
}

class _ToolbarButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  const _ToolbarButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Tooltip(
        message: tooltip,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(6),
            onTap: onPressed,
            child: Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              child: Icon(icon, size: 20, color: colorScheme.onSurfaceVariant),
            ),
          ),
        ),
      ),
    );
  }
}
