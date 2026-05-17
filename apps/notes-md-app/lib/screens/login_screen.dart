import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _serverController = TextEditingController();

  bool _isRegisterMode = false;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final server = context.read<AuthService>().server;
    _serverController.text = server;
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _serverController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();
    final server = _serverController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'Please fill in all fields.');
      return;
    }
    if (server.isEmpty) {
      setState(() => _error = 'Server URL is required.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    final auth = context.read<AuthService>();

    // Update server URL first
    await auth.setServer(server);

    final bool success;
    if (_isRegisterMode) {
      success = await auth.register(username, password);
    } else {
      success = await auth.login(username, password);
    }

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pushReplacementNamed('/home');
    } else {
      setState(() {
        _error = _isRegisterMode
            ? 'Registration failed. Username may already be taken.'
            : 'Login failed. Check your credentials and server URL.';
        _submitting = false;
      });
    }
  }

  void _useOffline() {
    Navigator.of(context).pushReplacementNamed('/editor');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // --- Title ---
                  const SizedBox(height: 32),
                  Text(
                    'notes.md',
                    style: theme.textTheme.headlineLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _isRegisterMode ? 'Create an account' : 'Sign in to sync',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 40),

                  // --- Server URL ---
                  TextField(
                    controller: _serverController,
                    decoration: InputDecoration(
                      labelText: 'Server URL',
                      prefixIcon: const Icon(Icons.dns_outlined, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                    style: theme.textTheme.bodySmall,
                    keyboardType: TextInputType.url,
                  ),
                  const SizedBox(height: 16),

                  // --- Username ---
                  TextField(
                    controller: _usernameController,
                    decoration: InputDecoration(
                      labelText: 'Username',
                      prefixIcon: const Icon(Icons.person_outline, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 16),

                  // --- Password ---
                  TextField(
                    controller: _passwordController,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      prefixIcon: const Icon(Icons.lock_outline, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                    ),
                    obscureText: true,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submitting ? null : _submit(),
                  ),
                  const SizedBox(height: 24),

                  // --- Error message ---
                  if (_error != null)
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.errorContainer,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.error_outline,
                            size: 18,
                            color: theme.colorScheme.onErrorContainer,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _error!,
                              style: TextStyle(
                                fontSize: 13,
                                color: theme.colorScheme.onErrorContainer,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // --- Submit button ---
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child: _submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              _isRegisterMode ? 'Register' : 'Login',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // --- Toggle login/register ---
                  TextButton(
                    onPressed: _submitting
                        ? null
                        : () {
                            setState(() {
                              _isRegisterMode = !_isRegisterMode;
                              _error = null;
                            });
                          },
                    child: Text(
                      _isRegisterMode
                          ? 'Already have an account? Login'
                          : 'No account? Register',
                      style: TextStyle(
                        color: theme.colorScheme.primary,
                        fontSize: 14,
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // --- Use Offline ---
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: OutlinedButton.icon(
                      onPressed: _submitting ? null : _useOffline,
                      icon: const Icon(Icons.cloud_off_outlined, size: 18),
                      label: const Text('Use Offline'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: theme.colorScheme.onSurfaceVariant,
                        side: BorderSide(
                          color: theme.colorScheme.outlineVariant,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // --- QR Pair link ---
                  TextButton(
                    onPressed: _submitting
                        ? null
                        : () {
                            Navigator.of(context)
                                .pushReplacementNamed('/pair');
                          },
                    child: Text(
                      'QR Pair',
                      style: TextStyle(
                        color: theme.colorScheme.onSurfaceVariant,
                        fontSize: 13,
                      ),
                    ),
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
