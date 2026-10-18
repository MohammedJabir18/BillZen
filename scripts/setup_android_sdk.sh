#!/usr/bin/env bash
set -e

TOOLCHAIN_DIR="/home/jabir/.android-toolchain"
SDK_DIR="$TOOLCHAIN_DIR/android-sdk"
JDK_DIR="$TOOLCHAIN_DIR/jdk"

echo "=== Setting up Android SDK from downloaded cmdline-tools ==="

if [ ! -f "$TOOLCHAIN_DIR/cmdline-tools.zip" ]; then
    echo "Error: cmdline-tools.zip not found in $TOOLCHAIN_DIR"
    exit 1
fi

mkdir -p "$SDK_DIR/cmdline-tools/latest"
rm -rf "$TOOLCHAIN_DIR/tmp-cmdline"
mkdir -p "$TOOLCHAIN_DIR/tmp-cmdline"

echo "Extracting cmdline-tools..."
unzip -q -o "$TOOLCHAIN_DIR/cmdline-tools.zip" -d "$TOOLCHAIN_DIR/tmp-cmdline"
cp -r "$TOOLCHAIN_DIR/tmp-cmdline/cmdline-tools/"* "$SDK_DIR/cmdline-tools/latest/"
rm -rf "$TOOLCHAIN_DIR/tmp-cmdline"

export JAVA_HOME="$JDK_DIR"
export ANDROID_HOME="$SDK_DIR"
export PATH="$JAVA_HOME/bin:$SDK_DIR/cmdline-tools/latest/bin:$SDK_DIR/platform-tools:$PATH"

echo "Java version:"
java -version

echo "sdkmanager version:"
sdkmanager --version

echo "Accepting licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true

echo "Installing platform-tools, android-34, build-tools 34.0.0, and NDK 26.1.10909125..."
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" "ndk;26.1.10909125"

echo "=== Android SDK setup completed successfully ==="
