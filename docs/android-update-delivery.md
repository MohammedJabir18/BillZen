# Android update delivery — implementation and verified release status

Status: **Updater-enabled bootstrap release APK (v0.1.1 / versionCode 1005) built, signed, and verified**. Full automated 27-assertion verification suite passed on Android 14 (`npm run test:android-update`). Signed release APK and signed production manifest ready in `dist-android/`.

BillZen now prepares anonymous signed release checks, bounded private APK downloads, Settings controls, certificate/package/version validation and Android installer consent. Offline company records remain local. The production feed is `https://github.com/MohammedJabir18/BillZen/releases/latest/download/android-update.json`. The original BillZen repository is public. The separate BillZen-releases repository was deleted at the owner's explicit request and confirmation.

## Blocking credentials

The existing APK keystore is present but its password is not available; the owner reports not knowing it. Its expected certificate SHA-256 is `becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`. Preserve the keystore and recover the original password from the owner's password manager or original secure build configuration. Do not brute-force it, publish it, or create a replacement production identity. A new unrelated certificate cannot update existing installations in place. Uninstalling the app to change certificates can erase device-local business data.

A separate Ed25519 manifest key pair must also be provisioned securely. `BILLZEN_ANDROID_UPDATE_PUBLIC_KEY` is the base64 raw 32-byte public key pinned at native compile time. Its private counterpart stays outside Git and signs metadata through `BILLZEN_ANDROID_MANIFEST_KEY_PATH`; it is separate from the Android APK keystore. No production manifest private key has been generated or committed here. Missing public key produces an explicit unavailable state; the distribution build script refuses to package an updater-disabled build.

Never send passwords or private keys in chat. Supply the recovered APK password only through a hidden terminal prompt or protected local environment. If the original keystore password cannot be recovered, stop distribution planning and decide a separately documented migration path with verified exports/backups before any uninstall or identity change.

## Release process

1. Keep `release/version.json`, package.json/package-lock.json, Cargo.toml/Cargo.lock, Tauri config and Android defaults aligned. The next candidate is 0.1.1/code 1005, above previously distributed code 1004. `node scripts/release/version.mjs` validates alignment; set `BILLZEN_PREVIOUS_VERSION_CODE` to the highest distributed code in release checks.
2. Run Node release tests, frontend/Rust suites, browser update checks, cashbook/theme/PDF gates and Android compilation/runtime checks.
3. Once credentials are available, set the pinned public key and run `bash scripts/build_android_apk.sh aarch64`. The script asks for the APK password without echo when run interactively, preserves the known certificate and checks signatures, embedded assets and 16 KB alignment. Do not use an unsigned APK or debug test build as a friend distribution.
4. Seed synthetic company, vouchers, balances, products, customers and appearance in an isolated installation. Build a second higher-code candidate using the same APK certificate and manifest key. Verify discovery, wrong signatures, wrong certificates, truncation, cancellation, permission return, process restart and populated upgrade. Android OS installer consent remains required.
5. Build metadata from the actual verified APK's SHA-256, byte size, ABI, minimum SDK, version and package. Use immutable release asset URLs under `/MohammedJabir18/BillZen/releases/download/vVERSION/`. `scripts/release/manifest.mjs` authenticates exact payload bytes and verifies its private key matches the pinned public key. The tests share a public, non-production signed fixture with the Rust verifier.
6. Upload all artifacts and `android-update.json` to a **draft** GitHub release. Review the complete release and its upgrade evidence before publishing. A normal source push runs CI and does not publish untested changes. Never replace assets under a published version.
7. Distribute the first accepted updater-enabled APK once. Later published higher-code releases can be discovered in Settings and in the background at most once per day while online.

## Scope and verification limits

The installer only accepts a fixed private cache APK via a separately scoped FileProvider. It checks real package metadata, a strictly higher versionCode, matching current signing certificates, minimum Android version and rejects debuggable packages. The Rust layer verifies the pinned Ed25519 metadata signature, channel/package/ABI, replay floor, HTTPS host/redirect rules, length and SHA-256 before marking an update ready. The serialized database worker snapshots via SQLite backup and pauses requests during installer handoff; cancellation/return resumes it. Startup creates another recovery snapshot before pending schema migrations, including externally installed bootstrap updates.

The UI detects dirty Settings and active mutations/backup operations. These guards and unit tests do not replace a real two-version Android installation test. No such installation test has passed yet. Android status/error text is currently English; existing appearance and business settings retain their languages.

Desktop AppImage/Windows/macOS updater work remains a separate U3 gate. Installing desktop JS dependencies does not activate desktop updates. Web delivery remains the website deployment path. No cloud business-data synchronization was added.
