# BillZen desktop installation

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
- Downloaded local installer: `dist-desktop/windows/v0.1.3/BillZen_0.1.3_x64-setup.exe`.
- Exact size: **5,363,984 bytes**; SHA-256 `94143328dacab8e90fa6d95e7865ebe92a779dc4f945cad1cdd3f16d26fdf5db`.
- Local file's checksum, size, PE header and source provenance match the successful runner artifact. NSIS uses a32-bit installer bootstrap executable for the x64 application payload; the setup file itself is not a raw64-bit app executable.
- This is an unsigned Windows beta candidate. No physical Windows runtime or printer test has been claimed. No Windows asset was added to the Android GitHub release, and no desktop updater feed was configured.
- The hosted workflow emits a non-fatal action Node20 deprecation warning (runner executes those actions under Node24); this did not fail the build. Node22 remains the selected application build toolchain.
