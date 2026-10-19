# Verification status

Review date: 2026-10-19. This file distinguishes local observations from product completion claims.

## Fresh verification

Fresh local runs during this documentation/upload session:

| Check | Result |
| --- | --- |
| `npm test` | 41 tests passed across 6 files (financial engine, backup canonicalization/crypto, IndexedDB web database) |
| `npm run build` | TypeScript and Vite production build passed cleanly |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 81 tests passed (67 unit tests + 14 integration tests, including backup export/restore, 4-tier validation, staging DB integrity, and cashbook V8 transactions) |
| Native Cashbook Desktop Verification (`npm run test:native-cashbook`) | 34 assertions passed across 12 steps on release binary `src-tauri/target/release/billzen` (SHA-256: `85f4dac...`, Git: `599a8c4...`). Tested: setup wizard, accounts, receipt, payment, negative balance confirmation, reversal, print DOM isolation, cold restart persistence (-₹84,000.00 balance preserved), idempotent conflict rejection, and untouched real database `~/.local/share/billzen` |
| Cashbook Playwright E2E (`npm run test:cashbook`) | All 12 scripted steps passed (dashboard, receipt/payment, negative balance guard, reversal, print modal, search filtering, mobile responsiveness, themes, reload persistence across browser restart, and backup export/restore roundtrip with corrupted file rejection) |
| Cashbook Voucher PDF Isolation (`npm run test:cashbook-pdf`) | All 3 scenarios passed (A4 1-page fit, 80mm thermal receipt geometry, and multi-page long text handling with zero invoice contamination) |
| Standalone Linux Release Binary (`src-tauri/target/release/billzen`) | Built release executable (15.70 MB, SHA-256: `85f4dac16e40a85e3b93b946c8e8ec77571ad47f1ff8fd3b9c9a96708fcb1099`, Git: `599a8c436eed824180a85999263013e963835fe5`) |
| `npm run test:responsive` | All 6 viewports passed (320, 360, 390, 412, 768, 1280) with zero horizontal document scroll, adaptive bottom navigation (<lg), scrollable modal drawers, and RTL |
| `npm run test:onboarding` | All 34 tests passed across 6 sections (3-step setup wizard, regional defaults for India & GCC, validation, guide navigation/skip/replay, 3-option appearance in Settings with strict isolation, dynamic OS dark/light following, print paper purity in dark mode, and computed-style dark mode contrast verification on Products, Customers, Settings, forms, and dialogs with contrast ratios 6.91:1 - 16.12:1) |
| Catalog Playwright (`npm run test:catalog`) | All 6 scripted steps passed |
| A4 PDF matrix (`npm run test:matrix`) | All 4 scenarios passed; page counts 1 / 3 / 1 / 1 |
| Catalog cross-process probe (`npm run test:native-probe`) | Separate write and read/verify processes passed with an isolated, cross-platform temporary database (`scripts/run_native_probe.js`) |
| Android Beta Release APK (`dist-android/billzen-beta-v0.1.0-arm64-v8a.apk`) | Built signed standalone ARM64 release APK (15M, SHA-256: `fb9f2d170afe535132a24329b5c5b5e6d6ce1b60b9adc0de39cbcf2a4d282279`, `versionCode = 1004`). Verified release variant selection, BillZen Beta certificate identity & SHA-256 fingerprint (`becf5a...`), 16 KB page-size ELF LOAD alignment (`0x4000`), 16 KB packaging alignment (`zipalign -c -v -P 16 4`), offline web assets & local fonts embedded in native library, safe area edge-to-edge insets, dynamic status bar & navigation bar contrast synchronization (`isAppearanceLightStatusBars = !isDark`), native back button modal handler, and WebView debugging restricted by default via `ENABLE_WEBVIEW_DEBUGGING = false` with dead-code bytecode elimination verified via `dexdump` (destined for user's friend) |
| Android Distribution x86_64 APK (`dist-android/billzen-dist-v0.1.0-x86_64.apk`) | Built signed standalone x86_64 distribution APK (14M, SHA-256: `f0d17778062f34a9b286eac685c9d65ec8096d1af26ba495b7d919d78e849aa8`, `versionCode = 1004`) with `ENABLE_WEBVIEW_DEBUGGING = false` and 0 debugging calls in bytecode (verified via `dexdump`) |
| Android Test APK (`dist-android/billzen-test-v0.1.0-x86_64.apk`) | Built signed test APK (14M, SHA-256: `adeda77f1ea88e64c6d9689f13fd0f1904b6da023dfa91732024e9dea51f5024`, `versionCode = 1004`) from the exact same commit, with `ENABLE_WEBVIEW_DEBUGGING = true` for automated CDP inspection, 16 KB page-size ELF alignment, and 16 KB packaging alignment (destined for local emulator verification) |
| Native Android Runtime Verification (`npm run test:android-runtime`) | PASSED: Executed automated 14-stage runtime test suite on headless Android 14.0 (API 34) x86_64 emulator (`billzen_test_avd`). Verified: Stage 0 distribution build blocks WebView debugging via bytecode `dexdump` audit while test build enables CDP; Stage 1 clean baseline v1003 installation; Stage 2 cold launch, 3-step setup wizard, interrupted setup draft recovery across cold restart (`localStorage` LevelDB sync); Stage 3 getting-started guide presentation & skip; Stage 4 baseline product creation with leading-zero barcode (`0012345678905`), customer record creation; Stage 5 bounded condition-based in-place upgrade to v1004 test APK with zero data loss (product, barcode, customer, business profile intact); Stage 6 Appearance settings on v1004 (Dark, Light, System dynamically following OS dark/light), edge-to-edge status bar & gesture navigation safe area insets with zero overlap, dynamic status bar icon contrast; Stage 7 native Back button (`keyevent 4`) dismissing open modal drawers without synthetic fallback or app exit; Stage 8 customer modal clean reopen; Stage 9 guide replay from Settings; Stage 10 process force-stop & cold restart state/appearance persistence; Stage 11 100% offline product creation/SQLite indexing (`svc wifi disable && svc data disable && airplane-mode enable`); Stage 12 post-offline cold restart persistence; Stage 13 run-scoped logcat audit (7,984 lines audited) confirming zero fatal exceptions or crashes. 11 native screenshots archived in `test_artifacts/android_runtime/` |
| Milestone 4A Specification (`docs/m4a-invoice-drafts-spec.md`) | Authoritative architecture specification completed covering draft invoice CRUD lifecycle, draft-to-finalization boundary, optimistic concurrency via `draft_version`, non-negative tracked stock invariants, line-item commercial snapshots, and exact integer half-up financial arithmetic |
| Documentation review | Relative links and source claims reviewed; minor corrections applied |

No GitHub Actions success is implied by local results. Physical printers were not tested. Graphify code-only refresh passed; full document extraction requires an unconfigured LLM API key and SQL AST extraction requires an optional missing parser.


## Resolved M3 & M3.1 Integrity Defects

1. **Stock reconciliation:** Untracked products reject opening stock at creation (`opening_stock_scaled > 0`). Transitioning from untracked to tracked product in `update_product` reconciles `current_stock_scaled` against `SUM(quantity_delta_scaled)` in `stock_movements`, rejecting any phantom stock balances.
2. **Catalog versus invoice price bounds:** Selling price and cost price are strictly bounded to `0 <= price <= MAX_MONEY_MINOR` (100,000,000,00) in both Rust worker and TypeScript UI validation. Inclusive maximums and update mutations are verified by unit tests.
3. **Quantity bounds:** Opening stock and minimum alert thresholds are strictly bounded to `0 <= quantity <= MAX_QUANTITY_SCALED` (1,000,000,000 scaled = 1,000,000.000 units) in both Rust worker and TypeScript UI validation. Inclusive maximums and update mutations are verified by unit tests.
4. **Category uniqueness & M3.1 Legacy Reconciliation:** Migration `v5_category_nocase.sql` transactionally reconciles legacy case-variant duplicates (e.g. `"Groceries"` vs `"groceries"`) to the earliest canonical category before applying `CREATE UNIQUE INDEX idx_categories_name_nocase ON categories(name COLLATE NOCASE)`. All referencing products are repointed, non-empty descriptions preserved, duplicates logged in `category_merges`, and dual-checksum backward compatibility (`INITIAL_V5_CHECKSUM`) maintained for existing V5 installations.
5. **Probe portability:** Replaced hardcoded POSIX `/tmp/` and `rm -f` commands in `package.json` with a cross-platform Node runner `scripts/run_native_probe.js` using `os.tmpdir()` and clean temporary directory lifecycle.
6. **Remote CI PDF Discrepancy (Section A):** Added `document.fonts.ready` webfont readiness wait and whitespace normalization in `scripts/verify_matrix_playwright.js`. Comparing text with collapsed whitespace prevents soft line-break differences across Linux fonts/distributions from failing tests while strictly preserving word sequence, numeric values, and forbidden UI string detection.

## Remaining Known Issues Before M4 Invoicing

1. **Native UI coverage:** Native Android runtime verification is automated and passing on Android 14 (`npm run test:android-runtime`). Desktop native UI tests are currently complemented by cross-process SQLite worker probes and browser/Playwright suites.
2. **Product scope:** Invoice draft/finalize transactions, stock decrements, payment allocation workflows, expense UI, backup/restore, encryption and synchronization remain incomplete for Milestone 4+.

Additional review targets: unsaved form navigation, localized input parsing, long catalog performance, native unauthorized-window command denial, responsive layouts and platform-specific printing.

## Publication scope

Catalog and responsive screenshots include synthetic browser captures (`test_artifacts/catalog/`, `test_artifacts/responsive/`) and real native Android runtime captures (`test_artifacts/android_runtime/`). The friend's release APK is standalone ARM64 (`dist-android/billzen-beta-v0.1.0-arm64-v8a.apk`); emulator runtime tests used an x86_64 test APK built from the identical commit. No production database or customer documents should be uploaded.

## Appearance visibility correction — 2026-10-19

Dark-mode inspection reproduced an almost invisible print-diagnostics heading, weak cashbook summary text, catalog placeholders and low-contrast action labels. These are corrected through component-specific theme colors; print documents keep their white-paper design. Native controls now follow CSS `color-scheme`.

The theme regression matrix covers 26 screen/dialog states at 1280px and 390px in both dark and light modes (104 checks), including populated cashbooks/catalogs, negative-balance warnings, backup confirmation, all guide slides and setup steps. It checks rendered text/placeholder contrast (4.5:1 normal text, 3:1 large text), selected theme and horizontal page overflow. Disabled controls, icon-only contrast, complex visual effects and full assistive-technology conformance require separate assessment.

Evidence: `test_artifacts/theme_contrast/report.json` and screenshots. Run `npm run test:theme`. Native print-heading/control checks run with `npm run test:native-cashbook` against a rebuilt binary and isolated data directory. Android/iOS and Windows/macOS runtime checks are separate from browser viewport tests.


## 2026-10-19 — Android updater source checkpoint

This is not an accepted distributable APK. The owner reports not knowing the original APK keystore password; no production manifest key is provisioned. No live release, signed bootstrap, two-version Android install or desktop updater acceptance was performed.

- Frontend: 43/43 tests passed and TypeScript/Vite build passed; existing bundle-size/dynamic-import warnings remain.
- Rust: 89 tests passed (67 unit + 14 existing integration + 3 recovery/quiescence + 5 manifest/cache/redirect tests). Signed invalid fixtures include 17 authentic but invalid payload cases. Recovery covers committed WAL content, pre-migration snapshot timing and fail-closed backup failure.
- Release scripts: 7 Node tests passed, including publisher cryptography/shared fixture, effective version overrides and Rust/Kotlin cache/lifecycle contracts. The source-contract test is not runtime device acceptance.
- Android: `:app:compileUniversalReleaseKotlin` passed after lifecycle/private-cache/approval fixes. This compiles Kotlin only; it does not prove a newly linked Android Rust library, signed APK or installer roundtrip. Existing AGP legacy API warnings remain.
- Browser update screen: 4/4 light/dark × 390/1280 scenarios passed for offline/unavailable/no-install controls and overflow, using synthetic isolated browser data.
- Existing PDF regression: 3/3 A4/80mm/invoice scenarios passed. Rendered theme regression: all 104 dark/light desktop/mobile state checks passed with no detected contrast failure or horizontal overflow.
- Fresh reviewer identified internal/external cache mismatch, view-local installer return and build override gaps. Corrections were implemented and covered by the checks above; actual activity recreation/installer behavior remains a mandatory native acceptance gate.
- CI gained release-contract, update screen and cashbook/theme/PDF gates. No release publishing workflow or remote CI success is claimed.
- Rustfmt is not installed in this local Rust toolchain; formatting tool was unavailable. `git diff --check` passed.

See `docs/android-update-delivery.md` and `docs/antigravity-next-task.md` for the secure signing handoff. C2 remains deferred.
