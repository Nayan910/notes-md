import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'database/database.dart';
import 'services/app_logger.dart';
import 'services/auth_service.dart';
import 'services/file_service.dart';
import 'services/file_watcher_service.dart';
import 'services/note_service.dart';
import 'services/server_config_service.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/pair_screen.dart';

final AppLogger _log = AppLogger();

/// Holds a file intent data received from another app (e.g. opening a .md file).
class IncomingFile {
  static String? content;
  static String? title;
}

/// App-scoped singletons. Created once at startup and shared with the
/// rest of the app via Provider (so screens and services can pick them
/// up without prop-drilling).
class AppServices {
  final AppDatabase database;
  final FileService fileService;
  final NoteService noteService;
  final FileWatcherService fileWatcher;

  AppServices({
    required this.database,
    required this.fileService,
    required this.noteService,
    required this.fileWatcher,
  });

  Future<void> dispose() async {
    await fileWatcher.stop();
    await noteService.dispose();
    await database.close();
  }
}

Future<AppServices> bootstrapServices() async {
  final db = AppDatabase.defaults();
  final fileService = FileService();
  final noteService = NoteService(
    fileService: fileService,
    database: db,
  );
  final fileWatcher = FileWatcherService(
    fileService: fileService,
    noteService: noteService,
  );

  AppLogger.i('Boot', 'Initializing FTS5 index…');
  try {
    final count = await noteService.indexAllFiles();
    AppLogger.i('Boot', 'Indexed $count notes');
  } catch (e) {
    AppLogger.w('Boot', 'Initial indexing failed (will retry on demand): $e');
  }

  try {
    await fileWatcher.start();
  } catch (e) {
    AppLogger.w('Boot', 'File watcher failed to start: $e');
  }

  return AppServices(
    database: db,
    fileService: fileService,
    noteService: noteService,
    fileWatcher: fileWatcher,
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  _setupIntentChannel();

  // Bootstrap singletons before the first frame. This is async because
  // AppDatabase + the file watcher need the platform-channel /
  // path_provider services to be ready, but the first frame only
  // renders once runApp() is called — so the user doesn't notice.
  final services = await bootstrapServices();

  runApp(
    MultiProvider(
      providers: [
        Provider<AppServices>.value(value: services),
        ChangeNotifierProvider(create: (_) => AuthService()..load()),
        ChangeNotifierProvider(create: (_) => ServerConfigService()..load()),
      ],
      child: const NotesMdApp(),
    ),
  );
}

void _setupIntentChannel() {
  if (!Platform.isAndroid) return;
  const channel = MethodChannel('com.notesmd.notes_md_app/file');
  channel.setMethodCallHandler((call) async {
    if (call.method == 'openFile') {
      IncomingFile.content = call.arguments['content'] as String?;
      IncomingFile.title = call.arguments['title'] as String?;
      _log.info('Received file intent: ${IncomingFile.title}');
    }
  });
}

class NotesMdApp extends StatelessWidget {
  const NotesMdApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'notes.md',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF4A9EFF),
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF4A9EFF),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      // Offline-first: launch directly into the editor
      initialRoute: '/',
      routes: {
        '/': (context) => const HomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/pair': (context) => const PairScreen(),
      },
    );
  }
}
