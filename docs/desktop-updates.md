# Desktop in-app updates

BillZen v0.1.6 introduces desktop update support. Existing v0.1.5 desktop installations need a one-time installer upgrade; they cannot acquire this feature through their old Settings screen.

## Supported editions

| Platform | Bootstrap installer | Subsequent updates |
|---|---|---|
| Windows x64 | `BillZen-0.1.6-Windows-x64.exe` | Signed NSIS installer, system consent when required |
| macOS Apple Silicon | `BillZen-0.1.6-macOS-AppleSilicon.dmg` | Signed `.app.tar.gz`; installed app/folder must be writable |
| Linux x64 | `BillZen-0.1.6-Linux-x64.AppImage` | Signed AppImage replacement; image and containing folder must be writable |
| Debian package / standalone binary | Manual installer | In-app updates unavailable; Settings explains the AppImage requirement |

On Mac, copy BillZen out of the mounted DMG into Applications before running it. Mac builds remain ad-hoc signed, without Apple Developer ID/notarization. Windows builds remain without Authenticode signing. Tauri update signatures authenticate update bytes; they do not replace OS publisher certification.

## Operator workflow

1. Open **Settings → App updates → Check for updates** while online.
2. Review the available version, select **Download update**, and wait for signature verification. Downloading does not close the app; it can be cancelled.
3. Save or cancel edits and close other dialogs. Select **Install update**.
4. BillZen checkpoints its SQLite WAL, creates a local recovery snapshot, pauses database operations and installs the verified package. Keep the app open until it restarts / the Windows installer takes over.
5. If preparation or installation fails, BillZen reports the failure and resumes database access. Check again and download a fresh copy before retrying an installation failure.

Startup checks run at most once per day when online. Downloads and installation require explicit actions. Offline business workflows continue without a network connection. No business records are sent to GitHub.

## Trust and persistence

The desktop-only Rust service owns the updater state and downloaded bytes. The webview can request five constrained operations; it cannot change the feed, signing public key or artifact URL. Only the main window has those command permissions; generic updater plugin IPC permissions are absent.

The production endpoint is `https://github.com/MohammedJabir18/BillZen/releases/latest/download/desktop-update.json`. Artifacts must have immutable HTTPS URLs beneath this repository's versioned GitHub Releases path. Tauri verifies the pinned public-key signature and its authenticated version before permitting installation (`requireSignedVersion: true`). A signature for an older release cannot authorize bytes advertised under a newer version. HTTPS/feed availability remains a distribution dependency; offline app data does not depend on it.

The service serializes operations, invalidates cancelled work, bounds metadata/download timeouts and caps downloads at256MiB. Before installation, all queued database work drains through the existing worker and update preparation rejects further operations. Unix relaunch allows a short bounded wait for the old instance's OS lock to release; locking is not disabled.

## Maintainer release checklist

- Keep the encrypted private key and its password outside the repository. Preserve both permanently in a secure backup. Losing the key prevents delivery to clients pinned to its public key; do not silently replace it.
- GitHub Actions secrets: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Never put private values in build-info files, CLI arguments, logs or release assets.
- Align versions with `release/version.json` and run `node scripts/release/version.mjs`, frontend/native tests, browser updater tests and publisher tests.
- Dispatch **Desktop Release Packages** for the complete matrix. It builds signed update artifacts, checks native domain/frontend gates, validates Windows icons and the Mac app actually mounted from the delivered DMG, and creates version-bound platform fragments.
- Collect all artifacts and `desktop-update.json`. Compare package hashes and verify each detached signature with the pinned key. Preserve artifact provenance. Update packages and ordinary installers must come from the verified build.
- Stage an unpublished release first. Include all three platform artifacts and their `.sig` files and the merged feed. Preserve the signed Android `android-update.json` on every new latest release, even when Android has no new version; its immutable APK link can remain at the previous release.
- Publish only after verification. Ordinary source pushes run CI; they do not publish application updates. Never replace assets for an already published version. Increment the app version for new delivered bytes.

The browser UI harness uses mocked native IPC and cannot prove OS installation. Native domain tests cover preparation and state guards; actual signed-package install/relaunch and physical Windows/macOS runtime checks require separate evidence in the release record.
