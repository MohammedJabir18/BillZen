# BillZen desktop installation

**Latest verified local build candidates: v0.1.4.** See [distribution files and checksums](distribution-v0.1.4.md). Windows friend file: `dist-desktop/windows/v0.1.4/BillZen_0.1.4_x64-setup.exe`. Linux per-user installation has been refreshed to this build. These candidates have not been promoted to a public release.

## Linux — installed for this user

The current verified build is installed at `~/.local/opt/billzen/billzen`; its launcher is `~/.local/share/applications/billzen.desktop`. Search **BillZen** in the applications menu. No administrator password is needed for this user-local installation.

The installer/launcher does not move, clear or bundle business records. Normal Linux data remains under `~/.local/share/billzen` (unless `BILLZEN_DATA_DIR` is explicitly configured). Back up through Settings before moving data between computers.

A Linux ELF executable or `.deb` cannot be used on Windows. The old local `BillZen_0.1.0_amd64.deb` is stale and should not be shared as the current app.

## Windows — installer build

The manually dispatched **Windows Installer** GitHub Actions workflow builds the locked source on Windows x64 using Tauri's NSIS bundler. The successful job's `BillZen-Windows-x64` artifact contains:

- `BillZen_<version>_x64-setup.exe`: send this installer to an x64 Windows friend.
- `SHA256SUMS.txt`: exact installer integrity checksum.
- `build-info.json`: source commit, run, version, size/hash and signing/runtime-test status.

Download the artifact and extract it before sharing. Do not send the Android APK, Linux executable, repository/source ZIP or internal automation build. The Windows friend runs the setup executable and follows the installer. The embedded web UI is local; a Windows WebView2 runtime is required. The first installation may need internet to obtain that prerequisite if it is missing.

This workflow has no Windows code-signing certificate. Windows may show an unrecognized publisher/SmartScreen warning; do not represent the installer as Microsoft-verified or direct users to disable security controls. A successful hosted build establishes packaging, not physical Windows runtime acceptance. Desktop automatic updates are not configured by this installer workflow; the existing signed Android release feed applies only to Android.

No business database, private key or credential is included in these installer artifacts. GitHub Actions artifacts have14day retention in this workflow; public release publication is a separate step.


## Verified Windows x64 candidate — 2026-10-22

- [Windows Installer run39775472312](https://github.com/MohammedJabir18/BillZen/actions/runs/39775472312) succeeded in8m36s, including frontend tests and NSIS packaging.
- Source commit: `3429893be3cf5fdfca353b48eed682b3927cc67d` (includes Print Probe removal).
- Original candidate (now archived): `dist-desktop/windows/v0.1.3-before-icon-fix/BillZen_0.1.3_x64-setup.exe`. The normal v0.1.3 path now contains the corrected branded build described below.
- Exact size: **5,363,984 bytes**; SHA-256 `94143328dacab8e90fa6d95e7865ebe92a779dc4f945cad1cdd3f16d26fdf5db`.
- Local file's checksum, size, PE header and source provenance match the successful runner artifact. NSIS uses a32-bit installer bootstrap executable for the x64 application payload; the setup file itself is not a raw64-bit app executable.
- This is an unsigned Windows beta candidate. No physical Windows runtime or printer test has been claimed. No Windows asset was added to the Android GitHub release, and no desktop updater feed was configured.
- The hosted workflow emits a non-fatal action Node20 deprecation warning (runner executes those actions under Node24); this did not fail the build. Node22 remains the selected application build toolchain.

## Linux menu icon repair

The October22 user-local launcher now uses the absolute icon path `~/.local/share/icons/hicolor/128x128/apps/billzen.png` expanded to the user's real home directory in its `Icon=` entry. The previous name-only entry failed GTK theme lookup because the user hicolor theme was missing its index. A standard hicolor index was installed and its cache refreshed; both Gio's file icon and GTK's named-icon lookup now resolve the canonical BillZen PNG. This changes launcher metadata, not business records or the app database.

For Windows, the NSIS installer/uninstaller icons are explicitly configured to use `src-tauri/icons/icon.ico`. The workflow checks actual application and setup PE icon resources against every canonical ICO frame before uploading the installer. Installer hash/provenance verification alone does not establish correct branding.


## Historical icon-corrected Windows v0.1.3 candidate — 2026-10-22

- [Windows run39778796695](https://github.com/MohammedJabir18/BillZen/actions/runs/39778796695) succeeded (2m43s), source `6abdf931bc56a1f6b1b45ea4ee3a395bcb02fdf3`.
- Historical file: `dist-desktop/windows/v0.1.3/BillZen_0.1.3_x64-setup.exe`. Use the v0.1.4 candidate linked above for the newer motion work. Identical v0.1.3 icon-corrected build is retained in `v0.1.3-icon-fix`; the older file is archived in `v0.1.3-before-icon-fix`.
- Size **5,348,901 bytes**; SHA-256 `6ab698cdbe9ba66282e0c6445e34b228ccdde246059817027a9a6fdb7833a67a`.
- Hosted verification compared actual PE icon resources in both `billzen.exe` and the setup executable with the canonical BillZen ICO at16/24/32/48/64/256px. All six frames matched in each executable. Downloaded setup independently passed the same resource check locally; checksum/size/source/iconVerified metadata matched.
- `icon-verification.json` accompanies the workflow artifact. The older installer fails this check, establishing a real regression reproduction. Installer/uninstaller use the same configured icon asset. This does not claim Windows shell/physical runtime acceptance or Authenticode signing.
- No business data, new Android release, desktop updater feed or public Windows release was changed by this icon correction.
