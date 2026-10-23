import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

val resolvedVersionCode = System.getenv("BILLZEN_VERSION_CODE")?.toIntOrNull()
    ?: (project.findProperty("versionCode") as? String)?.toIntOrNull()
    ?: tauriProperties.getProperty("tauri.android.versionCode")?.toIntOrNull()
    ?: 1010

val resolvedVersionName = System.getenv("BILLZEN_VERSION_NAME")
    ?: (project.findProperty("versionName") as? String)
    ?: tauriProperties.getProperty("tauri.android.versionName")
    ?: "0.1.5"

val resolvedWebviewDebugging = System.getenv("BILLZEN_ENABLE_WEBVIEW_DEBUGGING")?.toBooleanStrictOrNull()
    ?: (project.findProperty("enableWebviewDebugging") as? String)?.toBooleanStrictOrNull()
    ?: false

android {
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    namespace = "com.billzen.desktop"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.billzen.desktop"
        minSdk = 24
        targetSdk = 34
        versionCode = resolvedVersionCode
        versionName = resolvedVersionName
        buildConfigField("boolean", "ENABLE_WEBVIEW_DEBUGGING", resolvedWebviewDebugging.toString())
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            optimization {
               enable = true
            }
            proguardFiles(
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
