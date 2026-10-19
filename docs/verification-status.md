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
| `npm run test:onboarding` | All 32 tests passed across 6 sections (3-step setup wizard, regional defaults for India & GCC, validation, guide navigation/skip/replay, 3-option appearance in Settings with strict isolation, dynamic OS dark/light following, print paper purity in dark mode, and computed-style dark mode contrast verification on Products, Customers, Settings, forms, and dialogs with contrast ratios 6.91:1 - 16.12:1) |
| Catalog Playwright (`npm run test:catalog`) | All 6 scripted steps passed |
| A4 PDF matrix (`npm run test:matrix`) | All 4 scenarios passed; page counts 1 / 3 / 1 / 1 |
| Catalog cross-process probe (`npm run test:native-probe`) | Separate write and read/verify processes passed with an isolated, cross-platform temporary database (`scripts/run_native_probe.js`) |
| Android Beta APK Assembly & Verification (`scripts/build_android_apk.sh`) | Built signed standalone ARM64 release APK (`dist-android/billzen-beta-v0.1.0-arm64-v8a.apk`, 15M, SHA-256: `406f0027172b2af1cf69a7fbe219d50c2d7e6965f6bac1f18ea6adb213c75a72`). Verified exact release variant selection without debug fallback, BillZen Beta certificate identity & SHA-256 fingerprint, 16 KB page-size ELF alignment (`0x4000`), 4-byte `zipalign`, offline web assets & local fonts embedded in binary, and `versionCode = 1001` |
| Native Android Runtime Verification | PENDING: `adb devices -l` has 0 connected devices and `avdmanager list avd` has 0 emulators. APK built and validated structurally; runtime device verification will occur once physical hardware or emulator is provisioned |
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

1. **Native UI coverage:** The cross-process probe verifies database worker and process lifecycle but does not replace webview/IPC end-to-end tests. Browser mock tests cannot establish native UI persistence.
2. **Product scope:** Invoice draft/finalize transactions, stock decrements, payment allocation workflows, expense UI, backup/restore, encryption and synchronization remain incomplete for Milestone 4+.

Additional review targets: unsaved form navigation, localized input parsing, long catalog performance, native unauthorized-window command denial, responsive layouts and platform-specific printing.

## Publication scope

Documentation screenshots are synthetic browser demonstrations captured by the existing catalog script. They do not certify native runtime connectivity. No production database or customer documents should be uploaded.
