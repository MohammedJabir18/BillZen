# Verification status

Review date: 2026-10-19. This file distinguishes local observations from product completion claims.

## Fresh verification

Fresh local runs during this documentation/upload session:

| Check | Result |
| --- | --- |
| `npm test` | 14 tests passed across 2 files |
| `npm run build` | TypeScript and Vite production build passed cleanly |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 53 tests passed (including v6 migration repair scoping, unseen/skipped/completed guide status preservation across repeated restarts, checksum advancement, settings ownership isolation against stale profiles, duplicate category inheritance, creation ties, repeat migration idempotency, rollback, and unknown checksum rejection) |
| `npm run test:responsive` | All 6 viewports passed (320, 360, 390, 412, 768, 1280) with zero horizontal document scroll, adaptive bottom navigation (<lg), scrollable modal drawers, and RTL |
| `npm run test:onboarding` | All 34 tests passed across 6 sections (3-step setup wizard, regional defaults for India & GCC, validation, guide navigation/skip/replay, 3-option appearance in Settings with strict isolation, dynamic OS dark/light following, print paper purity in dark mode, and computed-style dark mode contrast verification on Products, Customers, Settings, forms, and dialogs with contrast ratios 6.91:1 - 16.12:1) |
| Catalog Playwright (`npm run test:catalog`) | All 6 scripted steps passed |
| A4 PDF matrix (`npm run test:matrix`) | All 4 scenarios passed; page counts 1 / 3 / 1 / 1 |
| Catalog cross-process probe (`npm run test:native-probe`) | Separate write and read/verify processes passed with an isolated, cross-platform temporary database (`scripts/run_native_probe.js`) |
| Android Beta Release APK (`dist-android/billzen-beta-v0.1.0-arm64-v8a.apk`) | Built signed standalone ARM64 release APK (15M, SHA-256: `a17e2e7986e2932751fc37332dc5c8c9ed21d7a5cb05f20869bf96465e967c9a`). Verified release variant selection, BillZen Beta certificate identity & SHA-256 fingerprint (`becf5a...`), 16 KB page-size ELF LOAD alignment (`0x4000`), 16 KB packaging alignment (`zipalign -c -v -P 16 4`), offline web assets & local fonts embedded in native library, safe area edge-to-edge insets, dynamic status bar & navigation bar contrast synchronization (`isAppearanceLightStatusBars = !isDark`), native back button modal handler, and authoritative `versionCode = 1003` (destined for user's friend) |
| Android Test APK (`dist-android/billzen-test-v0.1.0-x86_64.apk`) | Built signed test APK (14M, SHA-256: `df4096ef20ff9d1586a3cb314e67bd9fcb4b2ff3576ca213f3e15cfa0e779965`) from the exact same commit, with `versionCode = 1003`, 16 KB page-size ELF alignment, and 16 KB packaging alignment (destined for local emulator verification) |
| Native Android Runtime Verification (`npm run test:android-runtime`) | PASSED: Executed automated 13-stage runtime test suite on headless Android 14.0 (API 34) x86_64 emulator (`billzen_test_avd`). Verified clean baseline v1002 installation, cold launch, 3-step setup wizard, interrupted setup draft recovery across cold restart (`localStorage` LevelDB sync), getting-started guide presentation & skip, baseline product creation with leading-zero barcode (`0012345678905`), customer record creation, bounded condition-based in-place upgrade to v1003 test APK with zero data loss (product, barcode, customer, business profile intact), Appearance settings on v1003 (Dark, Light, System dynamically following OS dark/light), edge-to-edge status bar & gesture navigation safe area insets with zero overlap, dynamic status bar icon contrast (white icons in Dark mode, dark icons in Light mode), native Back button (`keyevent 4`) dismissing open modal drawers without synthetic fallback or app exit, customer modal clean reopen, guide replay from Settings, process force-stop & cold restart state/appearance persistence, 100% offline product creation/SQLite indexing (`svc wifi disable && svc data disable && airplane-mode enable`), post-offline cold restart persistence, and run-scoped logcat audit confirming zero fatal exceptions or crashes. 11 native screenshots archived in `test_artifacts/android_runtime/` |
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
