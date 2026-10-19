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

# Clean previous build artifacts to prevent stale fallbacks
BUILD_DIR="$ROOT_DIR/src-tauri/gen/android/app/build/outputs/apk"
rm -rf "$BUILD_DIR"

# Ensure frontend build passes
echo "--- 1. Building frontend assets ---"
npm run build

# Run Tauri Android Build
echo "--- 2. Building Android native binary & APK via Tauri CLI ---"
npx tauri android build --apk --target aarch64 --ci

# Locate generated APK
echo "Build outputs found in $BUILD_DIR:"
find "$BUILD_DIR" -type f -name "*.apk"

OUTPUT_DIR="$ROOT_DIR/dist-android"
mkdir -p "$OUTPUT_DIR"

# Select exact release variant and strictly reject debug fallback
RAW_APK=$(find "$BUILD_DIR" -type f -name "*universal*release*.apk" -o -name "*arm64*release*.apk" -o -name "*release*.apk" | grep -v "unaligned" | head -n 1 || true)

if [ -z "$RAW_APK" ]; then
    echo "ERROR: Release APK variant was not produced in $BUILD_DIR! (Debug fallback is strictly rejected)"
    exit 1
fi

echo "Selected Release APK: $RAW_APK"

SIGNED_APK="$OUTPUT_DIR/billzen-beta-v0.1.0-arm64-v8a.apk"
rm -f "$SIGNED_APK"

# Align and sign using the designated BillZen Beta Keystore
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

echo "--- 4. Verifying APK Signature & Certificate Identity ---"
apksigner verify --verbose "$SIGNED_APK"

CERT_OUTPUT=$(apksigner verify --print-certs "$SIGNED_APK")
echo "$CERT_OUTPUT"
if ! echo "$CERT_OUTPUT" | grep -q "CN=BillZen Beta"; then
    echo "ERROR: APK certificate subject does not match 'CN=BillZen Beta'!"
    exit 1
fi
if ! echo "$CERT_OUTPUT" | grep -qi "becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4"; then
    echo "ERROR: APK certificate SHA-256 fingerprint mismatch!"
    exit 1
fi
echo "Certificate identity verified successfully."

echo "--- 5. Verifying 4-byte Zipalign ---"
zipalign -c -v 4 "$SIGNED_APK"
echo "Zipalign 4-byte alignment verified."

echo "--- 6. Verifying 16 KB ELF Page-Size Alignment ---"
TMP_LIB_DIR="/tmp/billzen_lib_check_$$"
mkdir -p "$TMP_LIB_DIR"
unzip -p "$SIGNED_APK" "lib/arm64-v8a/libbillzen_lib.so" > "$TMP_LIB_DIR/libbillzen_lib.so"

READELF_BIN="$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-readelf"
if [ ! -x "$READELF_BIN" ]; then
    READELF_BIN="readelf"
fi

echo "Analyzing ELF LOAD segments with $READELF_BIN..."
LOAD_SEGMENTS=$("$READELF_BIN" -l "$TMP_LIB_DIR/libbillzen_lib.so" | grep "LOAD")
echo "$LOAD_SEGMENTS"

# Ensure all LOAD segments have Align 0x4000 (16384 bytes) or greater
NON_16K=$(echo "$LOAD_SEGMENTS" | awk '{print $NF}' | grep -v -E "0x[4-9a-fA-F][0-9a-fA-F]{3}|0x[1-9a-fA-F][0-9a-fA-F]{4}" || true)
if [ -n "$NON_16K" ]; then
    echo "ERROR: Detected ELF LOAD segment with alignment less than 16 KB (0x4000):"
    echo "$NON_16K"
    rm -rf "$TMP_LIB_DIR"
    exit 1
fi
echo "16 KB ELF page alignment verified across all LOAD segments."
rm -rf "$TMP_LIB_DIR"

echo "--- 7. Verifying Offline Resources in APK & Native Binary ---"
unzip -l "$SIGNED_APK" | grep "assets/tauri.conf.json" > /dev/null || { echo "ERROR: assets/tauri.conf.json missing in APK!"; exit 1; }
unzip -l "$SIGNED_APK" | grep "lib/arm64-v8a/libbillzen_lib.so" > /dev/null || { echo "ERROR: Native library missing in APK!"; exit 1; }

TMP_RES_DIR="/tmp/billzen_res_check_$$"
mkdir -p "$TMP_RES_DIR"
unzip -p "$SIGNED_APK" "lib/arm64-v8a/libbillzen_lib.so" > "$TMP_RES_DIR/libbillzen_lib.so"

if ! strings "$TMP_RES_DIR/libbillzen_lib.so" | grep "assets/index-" > /dev/null; then
    echo "ERROR: Compiled JS/CSS assets missing in embedded native binary!"
    rm -rf "$TMP_RES_DIR"
    exit 1
fi

if ! strings "$TMP_RES_DIR/libbillzen_lib.so" | grep "NotoSans" > /dev/null; then
    echo "ERROR: Offline local fonts missing in embedded native binary!"
    rm -rf "$TMP_RES_DIR"
    exit 1
fi
rm -rf "$TMP_RES_DIR"
echo "Offline assets and local fonts verified inside native binary."

echo "--- 8. Generating Final Checksums and Metadata ---"
SHA256=$(sha256sum "$SIGNED_APK" | awk '{print $1}')
FILESIZE=$(ls -lh "$SIGNED_APK" | awk '{print $5}')

echo "=========================================="
echo "Android Beta APK Ready!"
echo "Location:     $SIGNED_APK"
echo "Size:         $FILESIZE"
echo "SHA-256:      $SHA256"
echo "Package ID:   com.billzen.desktop"
echo "Version Name: 0.1.0"
echo "Version Code: 1001"
echo "ABI:          arm64-v8a"
echo "Min SDK:      24 (Android 7.0+)"
echo "Target SDK:   34 (Android 14)"
echo "=========================================="
