import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'services/app_logger.dart';
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

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  _setupIntentChannel();
  runApp(
    MultiProvider(
      providers: [
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
