# Customer cashbook integration delivery — 2026-10-23

Application source: `c5ab0c2b135dc60327d81e7cc40c76445dfa125d`. Local candidates retain version0.1.4/Android1009. No public GitHub release or updater feed was published in this section.

## Linux

- Release executable: `src-tauri/target/release/billzen`.
- Existing installation updated atomically at `/home/jabir/.local/opt/billzen/billzen`. Close/reopen BillZen to load it.
- Previous installation retained as `/home/jabir/.local/opt/billzen/billzen-before-customer-cashbook-20261023`.
- Shareable standalone copy: `dist-desktop/linux/customer-cashbook-20261023/billzen`; build receipt alongside it.
- Bytes:20,803,280. SHA256:`eefc4c13b90198aa1008a990846c64bd813a7f389abc196f15274e8278885ac6`.
- Exact final binary passed43 isolated native assertions including real Tauri customer linking/receipt/history/report/reversal, cold restart, idempotency and unchanged real-data fingerprints.
- Previously packaged `.deb`, AppImage and Windows installers are older candidates and were not replaced here. The current standalone is a Linux executable, not a Windows installer.

## Android ARM64

- Send `dist-android/billzen-beta-v0.1.4-arm64-v8a.apk` to an ARM64 Android user.
- Package:`com.billzen.desktop`; versionName0.1.4; versionCode1009; minimum API24 (Android7); target API34.
- Bytes:20,716,168. SHA256:`be504859b2ee36225888e81a4180392c744ec86cfad3d617683f0ae0df91b867`.
- Signed with the existing BillZen certificate SHA256:`becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`. Certificate/signature, release non-debuggable metadata, offline embedded resources, ZIP alignment and all ELF LOAD16KB segments verified. Current hashed frontend asset references and both new customer IPC commands are present in packaged native library.
- Existing production update public key was supplied to the build. This rebuild does not change the published update feed. A later in-app release update must have a strictly higher versionCode than1009.
- Install over the existing same-package/same-key app; do not uninstall/clear data to update. Android prompts for installation permission/confirmation normally. This ARM64 candidate was not tested on a physical phone or emulator in this section; Chrome responsive/RTL tests and native Rust tests are separate evidence.
- Existing signing credential was recovered only after the owner's explicit approval for prior build-log discovery, then used in child-process environment for local signing. It was not printed or written to Git; temporary build launcher removed. No new signing identity created.

## Source verification and remaining scope

Frontend76 tests; full Cargo94; foundation Chrome suite; linked customer UI flow and report context; existing Cashbook12, Reports68 and motion23/23 passed. The first native linked test incorrectly reused an intentionally negative synthetic account; a separate zero-opening account fixed the fixture and the exact final binary then passed all43 assertions.

Independent source review findings were corrected before source publication. Added both new real-browser suites to frontend CI. CI state must be read from the latest GitHub run; local green is not remote green.

Full semantic Graphify refresh remains unavailable without an API key. Code-only graph refresh succeeded with1634nodes/3432edges; SQL parser unavailable, curated/new documents were not semantically reindexed. Financial posting, backup/restore and new workflows require no network connection.

Next product phase: P2 atomic account transfers. Invoice posting/receivables/purchases/sync remain separate approved-design work, not features shipped by this foundation.
