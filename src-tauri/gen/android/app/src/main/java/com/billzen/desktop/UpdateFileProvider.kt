package com.billzen.desktop

import androidx.core.content.FileProvider

/**
 * Dedicated FileProvider subclass to avoid manifest collisions and ensure clean
 * URI permission isolation for update APK staging.
 */
class UpdateFileProvider : FileProvider()
