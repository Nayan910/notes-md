package com.notesmd.notes_md_app

import android.content.Intent
import android.net.Uri
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.BufferedReader
import java.io.InputStreamReader

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.notesmd.notes_md_app/file"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        handleIntent(intent, flutterEngine)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent, flutterEngine)
    }

    private fun handleIntent(intent: Intent?, engine: FlutterEngine?) {
        if (intent == null || engine == null) return
        if (intent.action != Intent.ACTION_VIEW) return

        val uri: Uri? = intent.data
        if (uri == null) return

        val content = readFileContent(uri) ?: return
        val fileName = uri.lastPathSegment ?: "document.md"

        MethodChannel(engine.dartExecutor.binaryMessenger, CHANNEL)
            .invokeMethod("openFile", mapOf(
                "content" to content,
                "title" to fileName
            ))
    }

    private fun readFileContent(uri: Uri): String? {
        return try {
            val inputStream = contentResolver.openInputStream(uri)
            val reader = BufferedReader(InputStreamReader(inputStream))
            val text = reader.readText()
            reader.close()
            text
        } catch (e: Exception) {
            null
        }
    }
}
