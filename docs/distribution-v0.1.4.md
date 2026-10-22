# BillZen v0.1.4 distribution candidates

Source: `39d6b99a4c1aacd97f5da2f98613c93e5b68146c`. Includes the navigation/summary motion fixes, More drawer and shared Cashbook dialog entries, reduced-motion correction, icon fixes and removal of the developer print probe. No business database is included.

Version: **0.1.4 / Android code1009**. Package/signing identities are retained. Public release promotion is separate from these local/hosted build candidates.

## Windows x64

Send `dist-desktop/windows/v0.1.4/BillZen_0.1.4_x64-setup.exe` to an x64 Windows friend.

- Hosted [Windows build39820175490](https://github.com/MohammedJabir18/BillZen/actions/runs/39820175490):success.
- Size:5,379,034 bytes; SHA256 `742339496f5bddd21371eca39e6dc00f882667155f3d11e8dd7cf7d73c23cfd5`.
- Downloaded bytes match hosted source/size/hash provenance. Canonical BillZen icon frames match application+setup on the runner and the downloaded setup locally.
- Unsigned beta installer; physical Windows runtime/printing not tested. Windows desktop automatic updates are not configured by this build workflow. Existing WebView2 provisioning requirements still apply.

## Linux x64

Standalone: `src-tauri/target/release/billzen`; shareable copies under `dist-desktop/linux/v0.1.4/`.

- Native executable:20,687,016 bytes; SHA256 `b45eb27c697df2f86bb8b9703b8442cc755e51b55a2b4cc15dae2a3fac277cdb`.
- Debian installer:`BillZen_0.1.4_amd64.deb`,13,003,226 bytes; SHA256 `18b6025734d33766deca2cf3939456c99788a23b00478ec05f388c200fd5b460`. Actual package metadata reports0.1.4/amd64.
- Native acceptance:39 assertions across13 steps passed using a separate temporary database; cold restart, balances, idempotency and real-data isolation passed. Preview DOM checked; physical printing not tested.
- Existing per-user desktop launcher executable refreshed atomically after verification. Prior binary retained at `~/.local/opt/billzen/billzen-v0.1.3-before-motion`. Reopen BillZen to use the new executable. Business records remain in their original data directory.
- AppImage:`BillZen_0.1.4_amd64.AppImage`,97,532,408 bytes; SHA256 `b55a0ff14d3455a18404651cd0e65982ef717308548656d6b56c715980dae662`. Type2 AppImage header verified. The packaged ELF has bundler-adjusted RUNPATH and consequently differs from the standalone hash; the actual AppImage independently passed all39 native assertions in extract-and-run mode.
- First AppImage cold-restart attempt passed26 assertions then failed because the standalone test harness terminated only the launcher, not its child process. A temporary harness copy used an isolated process group for termination; the complete39-check rerun passed, including cold restart and real-data isolation. No application code or packaged bytes were changed to obtain that result.
- Linux desktop updater feed is not configured by building these files.

## Android ARM64

Send `dist-android/billzen-beta-v0.1.4-arm64-v8a.apk` (also retained under `dist-android/v0.1.4/`). Size:20,572,808 bytes; SHA256 `34266dfa6fe77dfd4cd7e908eace52507de765b440140aa077d14405b7e6cb85`.

- Actual metadata:package `com.billzen.desktop`,version0.1.4/code1009,ARM64,minimum Android7/API24,target34. ARM64 handset acceptance is separate; this APK does not support32-bit-only phones.
- Original certificate SHA256 `becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`,v2/v3 signature,16KB zip/ELF alignment,embedded assets/fonts and disabled distribution WebView debugging verified by the build script. Original updater public pin retained; no replacement key.
- Dedicated Android14 test AVD in-place upgrade1008→1009:22/22 assertions passed. Baseline included5 synthetic vouchers,1 product and1 customer; settings/accounts/categories/parties/ledger/catalog/preferences matched before UI checks. Malayalam/Arabic Settings, populated Reports and cold restart passed without uninstalling or clearing storage. Evidence:ignored `test_artifacts/android_candidate/report.json`.
- Automation-only x86_64 APK:SHA256 `6f24cde989233528fa32a5fff0df6cd19f1fde55425dc6d643d174b1abc91259`. This debugging APK is not a friend distribution or update-feed asset. An interrupted test build was resumed and only the completed verified build counted. Emulator acceptance does not establish physical ARM64 handset or signed-feed download/installer-handoff acceptance.

Install a verified signed APK over the existing app; do not uninstall or clear app storage. Existing updater-enabled builds use the original repository's signed Android feed; publishing a verified APK and signed manifest is a separate action. Source push or local packaging alone does not deliver an update to existing recipients.

## Verification scope

The motion source CI [39819158173](https://github.com/MohammedJabir18/BillZen/actions/runs/39819158173) and versioned source CI [39820154911](https://github.com/MohammedJabir18/BillZen/actions/runs/39820154911) both succeeded, including Rust and frontend/browser acceptance. The versioned Rust runner's dependency-install phase was slow but completed without bypassing checks. Version guard against distributed code1008,3 release-contract test files and72 frontend tests passed locally. Native platform tests and physical-printer/handset acceptance are distinct from package/hash checks. macOS/iOS builds are outside this request's existing Linux/Windows/Android delivery paths.
