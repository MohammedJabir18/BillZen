#!/usr/bin/env bash
set -euo pipefail

TOOLCHAIN_DIR="/home/jabir/.android-toolchain"
mkdir -p "$TOOLCHAIN_DIR"
cd "$TOOLCHAIN_DIR"

echo "=== 1. Downloading and Installing OpenJDK 17 ==="
if [ ! -d "$TOOLCHAIN_DIR/jdk-17/bin" ]; then
    echo "Downloading JDK 17..."
    curl -L "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_linux_hotspot_17.0.20.1_1.tar.gz" -o jdk17.tar.gz
    mkdir -p jdk-17
    tar -xzf jdk17.tar.gz -C jdk-17 --strip-components=1
    rm -f jdk17.tar.gz
    echo "JDK 17 installed at $TOOLCHAIN_DIR/jdk-17"
else
    echo "JDK 17 already installed."
fi

export JAVA_HOME="$TOOLCHAIN_DIR/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"
"$JAVA_HOME/bin/java" -version

echo "=== 2. Downloading Android Command-Line Tools ==="
SDK_DIR="$TOOLCHAIN_DIR/android-sdk"
mkdir -p "$SDK_DIR/cmdline-tools"

if [ ! -d "$SDK_DIR/cmdline-tools/latest/bin" ]; then
    echo "Downloading cmdline-tools..."
    curl -L "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -o cmdline-tools.zip
    mkdir -p "$SDK_DIR/cmdline-tools/tmp"
    unzip -q cmdline-tools.zip -d "$SDK_DIR/cmdline-tools/tmp"
    mv "$SDK_DIR/cmdline-tools/tmp/cmdline-tools" "$SDK_DIR/cmdline-tools/latest"
    rm -rf "$SDK_DIR/cmdline-tools/tmp" cmdline-tools.zip
    echo "cmdline-tools installed at $SDK_DIR/cmdline-tools/latest"
else
    echo "cmdline-tools already installed."
fi

export ANDROID_HOME="$SDK_DIR"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "=== 3. Accepting Licenses and Installing SDK Packages ==="
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses || true

echo "Installing platforms;android-34, build-tools;34.0.0, platform-tools, ndk;26.1.10909125..."
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platform-tools" "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125"

echo "=== 4. Verifying Installation ==="
ls -la "$ANDROID_HOME/platforms"
ls -la "$ANDROID_HOME/build-tools"
ls -la "$ANDROID_HOME/ndk"

echo "=== Android Toolchain Setup Complete! ==="
