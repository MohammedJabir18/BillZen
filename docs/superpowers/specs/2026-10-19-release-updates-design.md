# BillZen — release delivery and in-app updates design

Status: proposed design for owner review; updater code, keys, release workflow and releases are not yet created.
Evidence baseline: local commit `443e7ca`. Business records remain local; release distribution is separate from data synchronization.

## Intended result

The owner publishes a tested version once. Existing installations discover it online, show the version and release notes, download the matching artifact after consent, and install through the platform's supported mechanism. Nobody needs repeated personal APK/installer messages. All billing/cashbook work continues offline when update services are unreachable.

One bootstrap upgrade is unavoidable: existing builds have no updater code. Users must install an updater-enabled build once over their existing installation. Never uninstall or clear application data for this transition. Preserve identifiers, signing identity, database location, schemas, preferences and ledger records.

## Current repository findings

- Tauri 2 + React/Vite; application version 0.1.0 and identifier `com.billzen.desktop`.
- Android versionCode is 1004 in the current configuration/build script. The next released code must exceed every previously distributed code, not merely a local Git commit count.
- Existing Android release script signs APKs and distinguishes distribution from debugging variants, but has workstation-specific SDK paths, fixed output filenames and repeated version defaults. It needs portable CI inputs before reuse in a release runner.
- `.github/workflows/ci.yml` tests Rust/frontend/catalog/responsiveness/onboarding/invoice scenarios. It does not publish releases or currently run every newer cashbook/theme acceptance gate.
- No Tauri updater dependency/configuration, updater artifacts, manifest endpoint, Updates Settings UI or Android update bridge exists.
- Linux delivery currently uses a standalone executable built with `--no-bundle`; this is not an updater-capable AppImage distribution.
- GitHub push was blocked by unavailable HTTPS authentication in the preceding delivery. Connected GitHub repository metadata verifies that `MohammedJabir18/BillZen` is private. Existing release assets and available signing secrets are not yet verified; CLI Git push authentication remains a separate unresolved issue.
- Current backup/recovery behavior needs explicit populated upgrade/recovery tests before being used as an automatic pre-update safeguard; its existence is not proof that recovery is production-ready.

## Proposed distribution choices

These are architectural recommendations, not choices already approved by the owner.

1. Start with direct Android APK updates for the existing friends/beta audience and Linux AppImage updates. Prepare Windows NSIS and macOS app-bundle release jobs, but advertise each target only after its build/install/upgrade gate passes.
2. Keep the confirmed-private source repository private. Proposed hosting is a separate public artifact-only repository (candidate name `BillZen-releases`, subject to owner approval) using GitHub Releases. A public HTTPS endpoint on the owner's website is an alternative. Verify anonymous downloads before enabling the production client; never embed GitHub account/PAT credentials in the app and never change repository visibility implicitly.
3. `main` pushes run CI. A deliberate version-tag/manual release run builds a draft. Publication/promotion is an explicit owner action after all advertised assets and upgrade gates pass. No unfinished commit becomes a public update simply because it was pushed.
4. Begin with one stable feed for recipients. CI drafts and debug APKs never appear in that feed. Add a separate beta feed only when its recipients/channel identity are explicitly defined.
5. New app installs check after startup without blocking the UI, at most once per configured interval (initial recommendation: 24 hours); Settings offers manual checks. Install requires consent and waits for active financial operations to complete. No forced update blocks offline billing.

## Shared Settings experience

An Updates section shows installed version, platform/channel, last successful check, Check for updates, release notes, Download/Install, progress, retry and Later. Distinguish offline, up-to-date, unsupported packaging, permission required, invalid signature, failed download and ready-to-install states. Use existing EN/ML/AR localization and accessible dark/light components.

The client downloads metadata/artifacts only. It sends no company profile, cashbook, database, customer records, backup, signing credentials or device identifiers. Checks are session/startup based, not an always-running background service. Internet is needed for discovery/download, not normal use.

## Desktop adapter

Use the stable, compatible Tauri 2 updater and process plugins, conditionally compiled for supported desktop targets. Preserve Android/iOS builds. Pin and lock the resolved compatible dependencies; verify toolchain requirements first.

Configure a pinned updater public key and an HTTPS manifest feed. Private updater signing keys stay outside Git and app bundles; CI signing material lives in appropriately restricted repository/environment secrets. Updater artifact signing is separate from Windows/macOS OS signing and from the Android keystore.

- Linux: distribute updater-capable AppImages; current loose ELF and package-manager installations receive an honest unsupported/manual/package-manager path. Verify install location is writable; do not silently elevate or promise loose-file replacement.
- Windows: prefer a consistent NSIS installation scope and identity. Test privilege behavior and process shutdown. Signed installer/update verification is mandatory; document SmartScreen/OS trust separately.
- macOS: use app-bundle update archives and the required signing/notarization distribution setup; Gatekeeper compatibility is a distinct acceptance gate.

Generate signed artifacts and `latest.json` with the official tauri-action where appropriate. Validate target/architecture, URL, version and embedded signature. Publish the complete manifest only after every advertised artifact is available. Desktop keys must use the official plugin format; do not implement replacement signature algorithms.

## Android adapter — existing direct APK audience

The official desktop updater plugin does not update Android. Implement a narrow native mobile plugin/bridge for signed release discovery, bounded download and OS package-install flow.

Use a separate Android release manifest containing schema version, channel, package ID, app version, increasing versionCode, supported min SDK, ABI-specific HTTPS asset URLs, sizes and digests. Authenticate metadata using Ed25519 (RFC 8032) with the Rust `ed25519-dalek` strict verification API and an app-pinned 32-byte public key. Resolve and lock a compatible maintained crate version before implementation. Do not treat a SHA-256 digest fetched beside an APK as publisher authentication.

Concrete manifest contract:
- One JSON envelope contains `schemaVersion: 1`, `keyId: "billzen-android-v1"`, `payloadBase64`, and `signatureBase64`. Sign the exact decoded UTF-8 payload bytes; do not reserialize/canonicalize them before verification. The signature is exactly 64 bytes. The key ID selects a compiled allowlist and cannot supply a new public key.
- Payload JSON contains the matching key ID, channel, package ID, SemVer version, integer versionCode, issuedAt, notes and ABI artifact entries (url, integer sizeBytes, lowercase SHA-256 digest and integer minSdk).
- Reject duplicate keys, invalid UTF-8/base64, wrong types, unsupported schemas, unknown signing keys and inconsistent key IDs. Limit the envelope to 128 KiB, decoded payload to 64 KiB, notes to 8 KiB and each APK to 256 MiB. Enforce streaming bounds even when Content-Length is absent or misleading.
- Download metadata only from the configured distribution feed. For GitHub hosting, APK URLs must identify the approved artifact repository and immutable release tag; permit only HTTPS GitHub-controlled asset redirects on an explicit reviewed hostname allowlist, with at most five redirects. No arbitrary URL from Settings, HTTP downgrade, token forwarding or credentials in URLs.
- Install only a versionCode strictly greater than installed. Persist the highest authenticated versionCode observed per channel; reject older metadata replays. Do not implement a forced minimum-version lockout for offline users.
- The publisher signs the exact payload bytes before envelope generation. Unit fixtures must be shared between manifest generator and native verifier, including byte mutation and unknown-key cases.

Before installation, validate manifest trust, bounded size, platform/ABI/SDK match, APK content digest, actual package ID/version and signing certificate compatibility with the installed app. Preserve `com.billzen.desktop` and the same existing distribution keystore/certificate (or a deliberately supported signing lineage). Never generate a replacement keystore as a convenience.

Download into application-private cache, clean partial files, and invoke the supported Android installer with a scoped `content://` URI or PackageInstaller session. If the install-from-this-source permission is needed, explain it at the point of use, open OS settings and resume safely after return. Handle install cancellation, activity recreation and process restart. Do not request storage-wide permissions, root or privileged silent-install capability.

Distribution manifests must exclude debug variants. Test APK signatures/16 KB compatibility using existing release safeguards. Private signing passwords must not appear in logs. Preserve data across in-place upgrades.

Google Play is a future alternative: Play distribution and Play-managed/in-app updates have their own signing/channel requirements. Do not assume the Play update API updates arbitrary APKs installed from messages. iOS updates remain through its approved distribution channel, not this desktop/APK updater.

## Release pipeline and ownership

Build/sign stages run only for trusted release refs; fork PRs cannot access signing secrets. Pin reviewed action revisions when implementing, use minimal workflow permissions and serialize stable publication to avoid competing manifests.

A release must:
1. Validate SemVer alignment in package.json, Cargo.toml/lock metadata, Tauri config, Android versionName and authoritative release metadata. Android versionCode increases strictly across published builds. Generate artifact names from this metadata; remove hard-coded output versions.
2. Run existing tests and explicit cashbook/theme/PDF gates. Use OS-specific runners for OS artifacts and verify Android on its own build/runtime path.
3. Build all requested targets, sign and verify them. Missing secrets fail that target closed; do not silently generate unsigned substitutes or advertise unavailable targets.
4. Upload to a draft release, produce provenance (source revision, clean/dirty status, version, hashes, certificate fingerprints and build targets), verify every advertised asset, then await explicit promotion.
5. Publish stable manifests and assets as one complete logical release. A failed/partial job must leave the previous stable feed usable. Versioned release assets remain immutable; never replace bytes under an already-published version.

Secret setup requires the owner's configured GitHub access and secure signing material. Do not ask for passwords/keystore files in chat. Verify presence and public fingerprints without printing secret values. This design does not authorize creating secrets, publishing a live release or changing repository visibility.

## Protect local financial data

Do not update during a posting, restore/import, migration or unsaved critical form. Before restart/install, quiesce the serialized database worker and create/verify a consistent pre-upgrade recovery snapshot using SQLite-supported mechanisms. Never copy an open WAL database with raw filesystem copying.

The bootstrap APK and externally installed updates also require protection: perform a consistent native recovery snapshot at startup **before applying pending database migrations**. Open the existing database with a low-level SQLite connection for this step; do not call the migration-applying initializer first. Cover older installations that have no updater code. If snapshot creation fails, do not migrate silently; offer retry/export/recovery guidance. Retain a recoverable prior database and a startup failure path. Existing raw filesystem-copy recovery code must not be assumed WAL-safe.

App upgrades use forward migrations and retain workspace paths and preferences. Test a populated older installation. If migration fails, retain the recovery snapshot and provide a repair/export path. Do not automatically downgrade an app against a newer incompatible database; a withdrawal of a bad release is followed by a tested higher-version fix.

## Ordered delivery and acceptance

- U0: approve this design, verify release-host access and signing continuity using public metadata, agree first distributed platforms. No runtime changes before approval.
- U1: central version metadata, release validation, pre-migration startup recovery, Settings state machine/adapters and offline/error tests. Use local fixtures, not a live public feed.
- U2: Android updater-enabled bootstrap APK and a second higher-version signed candidate; exercise discovery, permission/installer consent and upgrade on an emulator/device with seeded data. This is the priority recipient path.
- U3: Linux AppImage bootstrap/update test, then Windows/macOS jobs and verified installers as credentials/runners permit. Do not claim all platforms from Linux success.
- U4: prepare draft-only CI/CD and feed generation, prove failure isolation. Owner reviews before first live publication; distribute the bootstrap once.

Required cases: no network/timeout/404/rate limit; no update/same version/downgrade; malformed/wrong-channel/unsupported-ABI metadata; missing/invalid signature; modified/truncated APK or desktop archive; wrong package/certificate; cancellation/denied permissions; low disk; active posting; process restart during download; populated upgrade plus migration failure recovery; company profile, products, customers, voucher IDs/numbers, balances, audit and theme preserved.

Native two-version installation is the acceptance criterion. A mocked toast, generated manifest or green build alone cannot establish working auto-updates.

## Official research references

- [Tauri updater guide](https://v2.tauri.app/plugin/updater/)
- [Official updater platform support](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/updater)
- [Tauri GitHub release pipeline](https://v2.tauri.app/distribute/pipelines/github/)
- [Official tauri-action](https://github.com/tauri-apps/tauri-action)
- [How Android app updates work](https://developer.android.com/google/play/app-updates)
- [Android install-session user action](https://developer.android.com/reference/android/content/pm/PackageInstaller.SessionParams#setRequireUserAction(int))
- [Ed25519 verification API](https://docs.rs/ed25519-dalek/latest/ed25519_dalek/struct.VerifyingKey.html#method.verify_strict)
- [Ed25519 standard](https://www.rfc-editor.org/rfc/rfc8032)
- [Google Play in-app updates](https://developer.android.com/guide/playcore/in-app-updates)
