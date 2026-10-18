#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TOOLCHAIN_DIR="/home/jabir/.android-toolchain"
export JAVA_HOME="$TOOLCHAIN_DIR/jdk"
export ANDROID_HOME="$TOOLCHAIN_DIR/android-sdk"
export NDK_HOME="$ANDROID_HOME/ndk/26.1.10909125"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/36.0.0:$ANDROID_HOME/build-tools/34.0.0:$PATH"

KEYSTORE="${BILLZEN_KEYSTORE_PATH:-$TOOLCHAIN_DIR/billzen-beta.keystore}"
KEY_ALIAS="${BILLZEN_KEY_ALIAS:-billzen}"
KEY_PASS="${BILLZEN_KEYSTORE_PASS:-}"

# Support 16 KB page alignment for Android 15+ native libraries
export RUSTFLAGS="-C link-arg=-z -C link-arg=max-page-size=16384 ${RUSTFLAGS:-}"

echo "=== BillZen Android Beta Build Workflow ==="
echo "Java Home:    $JAVA_HOME"
echo "Android Home: $ANDROID_HOME"
echo "NDK Home:     $NDK_HOME"
echo "Rustflags:    $RUSTFLAGS"

if [ ! -d "$NDK_HOME" ]; then
    echo "Error: NDK 26.1 not found at $NDK_HOME"
    exit 1
fi

if [ -z "$KEY_PASS" ] && [ -t 0 ]; then
    read -s -p "Enter keystore password: " KEY_PASS
    echo
fi

if [ -z "$KEY_PASS" ]; then
    echo "Error: BILLZEN_KEYSTORE_PASS environment variable is required for signing"
    exit 1
fi

cd "$ROOT_DIR"

# Ensure frontend build passes
echo "--- 1. Building frontend assets ---"
npm run build

# Run Tauri Android Build
echo "--- 2. Building Android native binary & APK via Tauri CLI ---"
npx tauri android build --apk --target aarch64 --ci

# Locate generated APK
BUILD_DIR="$ROOT_DIR/src-tauri/gen/android/app/build/outputs/apk"
echo "Build outputs found in $BUILD_DIR:"
find "$BUILD_DIR" -type f -name "*.apk"

OUTPUT_DIR="$ROOT_DIR/dist-android"
mkdir -p "$OUTPUT_DIR"

# Check if release or debug APK was produced
RAW_APK=$(find "$BUILD_DIR" -type f -name "*release*.apk" | head -n 1 || true)
if [ -z "$RAW_APK" ]; then
    RAW_APK=$(find "$BUILD_DIR" -type f -name "*debug*.apk" | head -n 1 || true)
fi

if [ -z "$RAW_APK" ]; then
    echo "Error: No APK found in $BUILD_DIR"
    exit 1
fi

echo "Selected APK: $RAW_APK"

SIGNED_APK="$OUTPUT_DIR/billzen-beta-v0.1.0-arm64-v8a.apk"
rm -f "$SIGNED_APK"

# Check if already signed
IS_SIGNED=0
apksigner verify "$RAW_APK" > /dev/null 2>&1 && IS_SIGNED=1 || IS_SIGNED=0

if [ "$IS_SIGNED" -eq 1 ]; then
    echo "APK is already signed by build system. Copying to destination."
    cp "$RAW_APK" "$SIGNED_APK"
else
    echo "--- 3. Aligning and Signing APK with BillZen Beta Keystore ---"
    ALIGNED_APK="/tmp/billzen-aligned.apk"
    rm -f "$ALIGNED_APK"
    zipalign -v -p 4 "$RAW_APK" "$ALIGNED_APK"
    
    apksigner sign \
        --ks "$KEYSTORE" \
        --ks-key-alias "$KEY_ALIAS" \
        --ks-pass "pass:$KEY_PASS" \
        --out "$SIGNED_APK" \
        "$ALIGNED_APK"
    rm -f "$ALIGNED_APK"
fi

echo "--- 4. Verifying APK Signature ---"
apksigner verify --verbose "$SIGNED_APK"

echo "--- 5. Inspecting APK Contents & Architecture ---"
echo "Embedded native libraries:"
unzip -l "$SIGNED_APK" | grep "lib/" || true

echo "Embedded web assets:"
unzip -l "$SIGNED_APK" | grep "assets/" | head -n 15 || true

echo "Embedded fonts:"
unzip -l "$SIGNED_APK" | grep "fonts/" || true

echo "--- 6. Generating SHA-256 Checksum ---"
SHA256=$(sha256sum "$SIGNED_APK" | awk '{print $1}')
FILESIZE=$(ls -lh "$SIGNED_APK" | awk '{print $5}')

echo "=========================================="
echo "Android Beta APK Ready!"
echo "Location:  $SIGNED_APK"
echo "Size:      $FILESIZE"
echo "SHA-256:   $SHA256"
echo "ABI:       arm64-v8a"
echo "Min SDK:   24 (Android 7.0+)"
echo "Target SDK: 34 (Android 14)"
echo "=========================================="
