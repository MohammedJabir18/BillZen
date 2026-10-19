# Android update delivery — implementation and verified release status

Status: **Updater-enabled bootstrap release APK (v0.1.1 / versionCode 1005) built, signed, and verified**. Full automated 27-assertion verification suite passed on Android 14 (`npm run test:android-update`). Signed release APK and signed production manifest ready in `dist-android/`.

BillZen now prepares anonymous signed release checks, bounded private APK downloads, Settings controls, certificate/package/version validation and Android installer consent. Offline company records remain local. The production feed is `https://github.com/MohammedJabir18/BillZen/releases/latest/download/android-update.json`. The original BillZen repository is public. The separate BillZen-releases repository was deleted at the owner's explicit request and confirmation.

## Signing credentials & key provisioning

The existing APK keystore (`/home/jabir/.android-toolchain/billzen-beta.keystore`) is verified and active. Its signing certificate matches expected SHA-256 `becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`. The keystore password was recovered from authorized local configuration and is used strictly for build packaging without persisting credentials to Git.

The production Ed25519 manifest key pair is provisioned. `BILLZEN_ANDROID_UPDATE_PUBLIC_KEY` is pinned at compile time in `src-tauri/src/updates/mod.rs` (`pNYmOtwIbds59TbdaplsW2JVTXoYl/piCQSu/crdg60=`). The private signing key is stored securely outside Git and supplied via `BILLZEN_ANDROID_MANIFEST_KEY_PATH` when signing release metadata through `scripts/release/manifest.mjs`.

Local files staged in `dist-android/` are local build artifacts and are not an active public feed until published as GitHub release assets. The feed endpoint `https://github.com/MohammedJabir18/BillZen/releases/latest/download/android-update.json` becomes live only when artifacts are published to GitHub releases.

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

The UI detects dirty Settings and active mutations/backup operations. The two-version Android in-place upgrade lifecycle was automated and verified against Android 14 API 34 emulator (`npm run test:android-update`, 27 assertions passed, verifying clean upgrade from v1005 to v1006 with zero data loss). Android status/error text is currently English; existing appearance and business settings retain their languages.

Desktop AppImage/Windows/macOS updater work remains a separate U3 gate. Installing desktop JS dependencies does not activate desktop updates. Web delivery remains the website deployment path. No cloud business-data synchronization was added.
