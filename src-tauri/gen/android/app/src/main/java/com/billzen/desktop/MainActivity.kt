package com.billzen.desktop

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private var webViewInstance: WebView? = null

  class NativeBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun setDarkMode(isDark: Boolean) {
      activity.runOnUiThread {
        activity.applySystemBarsTheme(isDark)
      }
    }

    @JavascriptInterface
    fun setNetworkAvailable(isAvailable: Boolean) {
      activity.runOnUiThread {
        activity.webViewInstance?.setNetworkAvailable(isAvailable)
      }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    if (BuildConfig.ENABLE_WEBVIEW_DEBUGGING) {
      WebView.setWebContentsDebuggingEnabled(true)
    }
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
    if (BuildConfig.ENABLE_WEBVIEW_DEBUGGING) {
      WebView.setWebContentsDebuggingEnabled(true)
    }
    webViewInstance = webView
    webView.addJavascriptInterface(NativeBridge(this), "BillZenNative")
    setupNetworkMonitoring(webView)
    webView.post {
      updateInsets()
      syncSystemBarsFromDom()
    }
  }

  override fun onResume() {
    super.onResume()
    updateInsets()
    syncSystemBarsFromDom()
  }

  private fun setupNetworkMonitoring(webView: WebView) {
    try {
      val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
      val initialActive = cm.activeNetwork != null
      webView.setNetworkAvailable(initialActive)

      val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          runOnUiThread {
            webView.setNetworkAvailable(true)
          }
        }
        override fun onLost(network: Network) {
          runOnUiThread {
            try {
              val hasNetwork = cm.activeNetwork != null
              webView.setNetworkAvailable(hasNetwork)
            } catch (_: Exception) {}
          }
        }
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
          val hasInternet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
          runOnUiThread {
            webView.setNetworkAvailable(hasInternet)
          }
        }
      }
      cm.registerDefaultNetworkCallback(callback)
    } catch (_: Exception) {}
  }

  fun applySystemBarsTheme(isDark: Boolean) {
    val insetsController = WindowCompat.getInsetsController(window, window.decorView)
    // When isDark is true, status bar icons should be light (white) on dark background -> isAppearanceLight = false
    // When isDark is false, status bar icons should be dark (black) on light background -> isAppearanceLight = true
    insetsController.isAppearanceLightStatusBars = !isDark
    insetsController.isAppearanceLightNavigationBars = !isDark
  }

  private fun syncSystemBarsFromDom() {
    val wv = webViewInstance ?: return
    wv.evaluateJavascript(
      """
      (() => {
        const isDark = document.documentElement.classList.contains('dark');
        if (window.BillZenNative && window.BillZenNative.setDarkMode) {
          window.BillZenNative.setDarkMode(isDark);
        }
        if (!window.__billzenThemeObserver) {
          window.__billzenThemeObserver = new MutationObserver(() => {
            const dark = document.documentElement.classList.contains('dark');
            if (window.BillZenNative && window.BillZenNative.setDarkMode) {
              window.BillZenNative.setDarkMode(dark);
            }
          });
          window.__billzenThemeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
          });
        }
        return isDark;
      })()
      """.trimIndent()
    ) { result ->
      val isDark = result == "true"
      applySystemBarsTheme(isDark)
    }
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
