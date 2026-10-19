package com.billzen.desktop

import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File

/** Fixed private APK path, current signing identity, increasing version; no arbitrary paths or URLs. */
class UpdateInstaller(private val activity: MainActivity) {
  @Suppress("DEPRECATION")
  fun device(): String {
    val current = activity.packageManager.getPackageInfo(activity.packageName, 0)
    val code = if (Build.VERSION.SDK_INT >= 28) current.longVersionCode else current.versionCode.toLong()
    return JSONObject().put("versionCode", code).put("abi", Build.SUPPORTED_ABIS.first()).put("sdk", Build.VERSION.SDK_INT).toString()
  }

  @Suppress("DEPRECATION")
  private fun certificates(info: PackageInfo): Set<String> {
    val signatures = if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures
    return signatures?.map { java.security.MessageDigest.getInstance("SHA-256").digest(it.toByteArray()).joinToString("") { byte -> "%02x".format(byte) } }?.toSet() ?: emptySet()
  }

  @Suppress("DEPRECATION")
  fun install(): String {
    return try {
      val directory = File(activity.cacheDir, "updates")
      val apk = File(directory, "update.apk")
      val approval = File(directory, "install-approved")
      if (!approval.isFile || approval.length() > 4096) return "error:Save your work and prepare the update again."
      val authorization = JSONObject(approval.readText())
      val approvedAt = authorization.getLong("approvedAt")
      if (System.currentTimeMillis() - approvedAt !in 0..30000) return "error:Update authorization expired. Try again."
      if (!approval.delete()) return "error:Cannot consume update authorization."
      if (!apk.isFile || apk.length() !in 1..268435456) return "error:Downloaded update is missing or invalid."
      if (apk.length() != authorization.getLong("sizeBytes")) return "error:Cached update size changed. Download again."
      val digest = java.security.MessageDigest.getInstance("SHA-256")
      apk.inputStream().use { input ->
        val buffer = ByteArray(65536)
        while (true) { val count = input.read(buffer); if (count < 0) break; digest.update(buffer, 0, count) }
      }
      val actualHash = digest.digest().joinToString("") { byte -> "%02x".format(byte) }
      if (actualHash != authorization.getString("sha256")) return "error:Cached update checksum changed. Download again."
      val pm = activity.packageManager
      val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
      val downloaded = pm.getPackageArchiveInfo(apk.absolutePath, flags) ?: return "error:Android cannot read this update."
      if ((downloaded.applicationInfo?.flags ?: 0) and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) return "error:Debug builds cannot be installed through release updates."
      val installed = pm.getPackageInfo(activity.packageName, flags)
      val nextCode = if (Build.VERSION.SDK_INT >= 28) downloaded.longVersionCode else downloaded.versionCode.toLong()
      val oldCode = if (Build.VERSION.SDK_INT >= 28) installed.longVersionCode else installed.versionCode.toLong()
      if (downloaded.packageName != activity.packageName || nextCode <= oldCode || nextCode != authorization.getLong("versionCode")) return "error:Update package or version does not match."
      val currentCertificates = certificates(installed)
      if (currentCertificates.isEmpty() || certificates(downloaded) != currentCertificates) return "error:Update signing certificate does not match this installation."
      if (Build.VERSION.SDK_INT >= 24 && (downloaded.applicationInfo?.minSdkVersion ?: Int.MAX_VALUE) > Build.VERSION.SDK_INT) return "error:Update requires a newer Android version."
      if (Build.VERSION.SDK_INT >= 26 && !pm.canRequestPackageInstalls()) {
        activity.updateInstallerActive = true
        activity.runOnUiThread {
          try { activity.startActivityForResult(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")), REQUEST_CODE) }
          catch (_: Exception) { activity.updateInstallerReturned() }
        }
        "permission"
      } else {
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", apk)
        activity.updateInstallerActive = true
        activity.runOnUiThread {
          val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            putExtra(Intent.EXTRA_RETURN_RESULT, true)
            clipData = android.content.ClipData.newRawUri(null, uri)
          }
          val resolved = activity.packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
          for (info in resolved) {
            try { activity.grantUriPermission(info.activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) {}
          }
          for (pkg in listOf("com.google.android.packageinstaller", "com.android.packageinstaller")) {
            try { activity.grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: Exception) {}
          }
          try { activity.startActivityForResult(intent, REQUEST_CODE) } catch (_: Exception) { activity.updateInstallerReturned() }
        }
        "installer"
      }
    } catch (_: Exception) { "error:Cannot open the Android installer. Your current app and records are unchanged." }
  }
  companion object { const val REQUEST_CODE = 7342 }
}
