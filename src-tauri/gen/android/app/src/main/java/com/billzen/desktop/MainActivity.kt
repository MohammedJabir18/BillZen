package com.billzen.desktop

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private var webViewInstance: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, insets ->
      updateInsets(insets)
      insets
    }

    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        val wv = webViewInstance
        if (wv != null) {
          wv.evaluateJavascript(
            """
            (() => {
              const evt = new CustomEvent('billzen-back-button', { cancelable: true });
              const handled = !window.dispatchEvent(evt);
              if (handled) return true;
              const openDialog = document.querySelector('[role="dialog"]');
              if (openDialog) {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
                return true;
              }
              return false;
            })()
            """.trimIndent()
          ) { result ->
            val isHandled = result == "true"
            if (!isHandled) {
              isEnabled = false
              onBackPressedDispatcher.onBackPressed()
              isEnabled = true
            }
          }
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
          isEnabled = true
        }
      }
    })
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webViewInstance = webView
    webView.post {
      updateInsets()
    }
  }

  override fun onResume() {
    super.onResume()
    updateInsets()
  }

  private fun updateInsets(providedInsets: WindowInsetsCompat? = null) {
    val wv = webViewInstance ?: return
    val insets = providedInsets ?: ViewCompat.getRootWindowInsets(window.decorView) ?: return
    val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
    val density = resources.displayMetrics.density
    val topDp = (systemBars.top / density).toInt()
    val bottomDp = (systemBars.bottom / density).toInt()

    wv.evaluateJavascript(
      """
      document.documentElement.style.setProperty('--sat', '${topDp}px');
      document.documentElement.style.setProperty('--sab', '${bottomDp}px');
      """.trimIndent(),
      null
    )
  }
}
