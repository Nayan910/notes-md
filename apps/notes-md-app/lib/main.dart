import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/auth_service.dart';
import 'screens/pair_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/editor_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthService()..load(),
      child: const NotesMdApp(),
    ),
  );
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
      initialRoute: '/loading',
      routes: {
        '/loading': (context) => const _LoadingScreen(),
        '/login': (context) => const LoginScreen(),
        '/pair': (context) => const PairScreen(),
        '/home': (context) => const HomeScreen(),
        '/editor': (context) => const EditorScreen(),
      },
    );
  }
}

/// Initial loading screen that checks if the user is already authenticated.
class _LoadingScreen extends StatefulWidget {
  const _LoadingScreen();

  @override
  State<_LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<_LoadingScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final auth = context.read<AuthService>();
    // Wait for auth state to load
    if (auth.isLoading) {
      await Future.delayed(const Duration(milliseconds: 500));
    }
    if (!mounted) return;

    Navigator.of(context).pushReplacementNamed(
      auth.isAuthenticated ? '/editor' : '/login',
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('notes.md'),
          ],
        ),
      ),
    );
  }
}
