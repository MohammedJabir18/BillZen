# Verification status

Review date: 2026-10-20. This file distinguishes local observations from product completion claims.

## Phase UI-2 Dashboard migration — 2026-10-20, 11:27 IST

Migrated Dashboard (`src/components/DashboardView.tsx`) to Precision Ledger design system tokens. Rebuilt standalone release executable and executed complete local verification suite.

- `npm test`: **63/63 tests passed across 12 files** (including 6/6 in `DashboardView.test.tsx` verifying `#ceeaa0` featured styling, tactile button compression, and dynamic account balances).
- `npm run test:dashboard`: **25/25 assertions passed across 9 scenarios** (Today default, 4 summary cards, non-profit disclaimer, interactive SVG analytics chart, period filtering, search decoupling, CSV export, printable root, and mobile/dark modes).
- `npm run test:responsive`: **6/6 viewports passed with 0px horizontal scroll** (320, 360, 390, 412, 768, 1280).
- `npm run test:theme`: **104/104 dark/light state contrast checks passed** with zero contrast failures and zero overflow.
- `npm run test:layout`: **906/906 layout states passed** across 10 viewports, 3 languages, and light/dark modes with 0 failures.
- Production screenshots: **8 genuine screenshots captured** across viewports, themes, and views (`test_artifacts/ui2_dashboard/`).
- Linux standalone release executable: Rebuilt `src-tauri/target/release/billzen` (v0.1.2, SHA-256 `8d27d447c2f873235c2b90d264abb6146fbb06443117937b680ad6559e9b68ee`, size 20,665,016 bytes).
- Native desktop runtime verification (`npm run test:native-cashbook`): **39/39 assertions across 13 steps passed** using isolated temporary SQLite database; cold restart, balances, idempotency/conflicts, and real business database fingerprints confirmed untouched.
- Android APKs, AppImage/deb installers, and live GitHub release assets were not rebuilt or published in this phase. UI-3 Cashbook redesign is the next phase.

## Linux desktop UI-1 rebuild — 2026-10-20, 10:49 IST

Rebuilt the existing standalone executable from verified UI-1 source `ea854d8d47c953376f9ca07028966648f9a662a1`. No application source or version change was required.

- `npm run tauri build -- --no-bundle`: passed; TypeScript/Vite passed and optimized Rust build completed. Existing chunk-size/static-dynamic import warnings remain.
- Executable: `src-tauri/target/release/billzen`, v0.1.2, 20,661,096 bytes.
- SHA-256: `cf0b9085fcf439475ed1053a22e386209a737eabbd5c058af204929ff27d9187`.
- Native isolated-database verification: **42/42 assertions across 14 steps passed**. Three additional build-specific checks confirmed the `Offline Business Suite` header, Precision Ledger active navigation colors and semantic canvas token inside the actual native executable.
- Receipt/payment creation, negative-balance confirmation, reversal, light/dark print-preview visibility, cold restart, idempotency/conflict rejection and unchanged real-business-database fingerprints passed.
- Build receipt and temporary verification runner are under ignored `test_artifacts/native_ui1_rebuild/`; the native result is under ignored `test_artifacts/native_cashbook/`.
- This updates the loose Linux executable only. Android APKs, AppImage/deb installers and live GitHub release assets were not rebuilt or published. UI-2 Dashboard redesign is not part of this build. Physical printing was not exercised.

## Responsive correction — fresh local verification, 2026-10-20

The responsive UI was audited against baseline `a31b95c` and corrected in the shared React source. See [responsive-layout-audit.md](responsive-layout-audit.md) for reproduced defects and [antigravity-next-task.md](antigravity-next-task.md) for packaging handoff.

| Check | Actual result this correction |
| --- | --- |
| Production build | TypeScript and Vite passed; existing bundle-size/static-dynamic import warnings remain |
| Frontend unit tests | 53/53 across 11 files |
| New rendered layout matrix | **906/906 states, zero failures**; ten widths (including 568×320 landscape), en/ml/ar, light/dark; all seven destinations, custom dates, large amounts/long account names, forms, restore/negative confirmations, guide, setup, paper scrolling and menu keyboard/back/resize cleanup |
| Existing responsive browser suite | 6/6 viewports passed |
| Dashboard/report browser acceptance | 25/25 assertions passed |
| Onboarding/appearance suite | 34/34 passed; synthetic catalog rows now precede table-header contrast checks |
| Theme/contrast matrix | 104/104 passed after Restore hover correction |
| Update screen browser checks | 4/4 passed through visible desktop/mobile navigation |
| Cashbook browser workflows | 12/12 steps passed, including negative guards, reversal, persistence and backup restore |
| Cashbook/invoice PDF isolation | 3/3 scenarios passed; A4 and 80mm paper geometry retained |
| Linux release executable | Rebuilt `src-tauri/target/release/billzen`, v0.1.2; SHA-256 `7ca1983d5d15805f2bfd21b40a26a29d31839202c35e7ab47db73db8b3673234` |
| Linux native runtime | 39/39 assertions across 13 steps passed using temporary SQLite data; cold restart, balances, idempotency/conflicts and real database fingerprints verified |
| Independent review / whitespace | No critical/important findings; `git diff --check` passed |

Native verification initially exposed two outdated harness assumptions: fixed 1.2s/English-text onboarding detection and Cashbook as the cold-start destination. It now waits for the actual wizard and verifies the approved Today dashboard before opening Cashbook and running the unchanged persistence assertions. The earlier failed runs are not counted as passes.

The native test exercised WebKit/SQLite and preview DOM; it did not open a physical printer dialog. Rust backend code was unchanged and Cargo suites were not rerun for this correction. Android runtime/update helpers were adapted to More navigation and syntax-checked; Android APKs were **not rebuilt or device-tested** in this correction. Windows/macOS/iOS were not run. Existing APK/release artifacts below belong to the earlier packaging session and do not contain these responsive changes.

The mandatory Graphify full sync was attempted but semantic extraction lacks an API key. A local code-only AST refresh succeeded; a full semantic/Obsidian regeneration is not claimed. Curated vault notes were retained and architecture/session notes updated.

GitHub push authentication preflight failed (`could not read Username for https://github.com: terminal prompts disabled`). Local verification does not imply remote CI success. No live release was published.

## Earlier C1.5 packaging verification (v0.1.2 / versionCode 1007)


Historical local runs reported during the preceding dashboard, reporting, and release packaging session:

| Check | Result |
| --- | --- |
| `npm test` | 53 tests passed across 11 files (financial calculation engine, CSV export & formula injection defenses, DashboardView, ReportsView, PrintableReportDocument, backup canonicalization/crypto, IndexedDB web database) |
| `npm run build` | TypeScript and Vite production build passed cleanly (`tsc && vite build`) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 90 tests passed (67 unit tests + 15 cashbook worker & reporting parity tests + 3 recovery tests + 5 update manifest tests) |
| `node --test scripts/release/tests/*.mjs` | 7 tests passed (version validation, publisher key pinning, exact UTF-8 byte signing, untrusted URL rejection, installer handoff) |
| Dashboard & Reporting E2E (`npm run test:dashboard`) | 25 assertions passed across 9 scenarios: Today default, 4 summary cards, non-profit terminology disclaimer, SVG analytics bar chart & category breakdown, period/custom range controls, filter matching banner decoupling from opening/closing balances, RFC 4180 CSV export with formula injection sanitization, A4 printable document isolation, and mobile/dark mode checks |
| `npm run test:responsive` | All 6 viewports passed (320, 360, 390, 412, 768, 1280) with zero horizontal document scroll, adaptive bottom navigation (<lg), scrollable modal drawers, and RTL |
| `npm run test:theme` | All 104 dark/light desktop and mobile state contrast checks passed cleanly with zero horizontal overflow |
| Cashbook & Report PDF Isolation (`npm run test:cashbook-pdf`) | All 3 scenarios passed (A4 voucher 1-page fit, 80mm thermal receipt geometry, and A4 invoice with total absence of cross-document text) |
| Standalone Linux Release Binary (`src-tauri/target/release/billzen`) | Built release executable v0.1.2 (`src-tauri/target/release/billzen`) |
| Android Beta Release APK (`dist-android/billzen-beta-v0.1.2-arm64-v8a.apk`) | Built signed standalone ARM64 release APK (20,535,944 bytes, SHA-256: `949551401f8a4fba919dd9e6381310cef38d97a8b0774a796658f412b9ffeb34`, `versionCode = 1007`, `versionName = 0.1.2`). Verified 16 KB page-size ELF LOAD alignment (`0x4000`), 16 KB packaging alignment (`zipalign -P 16 4`), and v2+v3 signatures with production certificate |
| Signed Android Manifest (`dist-android/android-update.json`) | Generated Ed25519 signed production manifest with pinned public key `pNYmOtwIbds59TbdaplsW2JVTXoYl/piCQSu/crdg60=` and SHA-256 bound to v0.1.2 APK |
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

## 2026-10-19 / 2026-10-20 — Android In-App Update Verification & Bootstrap Release Delivery

Empirical runtime verification and production packaging completed for BillZen Beta v0.1.1 (versionCode 1005):

- **Automated Native Android Update Gate (`npm run test:android-update`)**: 27/27 assertions passed across 9 stages on headless Android 14 (API 34) emulator (`emulator-5554`):
  1. *Stage 1 (Clean Baseline & Cert Identity)*: Installed baseline v1005; verified signing certificate SHA-256 (`becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`).
  2. *Stage 2 (Cold Launch & Onboarding)*: NativeBridge exposed, device info verified (`versionCode: 1005`, `abi: x86_64`, `sdk: 34`), setup wizard completed.
  3. *Stage 3 (Business Records Seeding)*: Seeded leading-zero barcode product (`0012345678905`), customer, cashbook account ("Main Drawer" with ₹65,000.00 balance across 2 vouchers), and dark appearance preference.
  4. *Stage 4 (Tampering & Security Defenses)*: Rejection of corrupt APK hash, corrupt size, mismatched certificate signature, expired authorization timestamp, and version downgrade verified.
  5. *Stage 5 (Permission Flow & Cancellation)*: `REQUEST_INSTALL_PACKAGES` permission prompt, launcher activation, back-key cancellation, and database worker resumption verified.
  6. *Stage 6 (Real In-Place OS Upgrade)*: Executed genuine Android OS `PackageInstaller` upgrade from v1005 to v1006 via isolated `UpdateFileProvider` and granted `ClipData` URI permissions.
  7. *Stage 7 (Cold Launch Upgraded App)*: Relaunched upgraded application, verified NativeBridge device info confirms `versionCode: 1006`.
  8. *Stage 8 (Zero Data Loss Verification)*: Complete business profile intact, leading-zero barcode product intact, customer intact, cashbook ledger and closing balance intact (₹65,000.00), and dark theme persisted.
  9. *Stage 9 (Pre-Migration Recovery Snapshots)*: Verified standalone SQLite snapshot created in `/data/user/0/com.billzen.desktop/recovery/before-app-update-*.db`.
  Evidence: `test_artifacts/android_update/android_update_verification_report.json` and 4 native screenshots.

- **Signed ARM64 Bootstrap Distribution Release APK**:
  - Location: `dist-android/billzen-beta-v0.1.1-arm64-v8a.apk`
  - Exact Size: 20,544,136 bytes (20M)
  - SHA-256: `495f086218303099edece69c2435106e36bf9072b2821085ea6f9f7897ab5d99`
  - Package ID: `com.billzen.desktop`
  - Version Name: `0.1.1`, Version Code: `1005`, Min SDK: `24`, Target SDK: `34`
  - 16 KB Packaging Alignment: Verified via `zipalign -c -v -P 16 4`
  - 16 KB Page-Size ELF LOAD Alignment: Verified across all LOAD segments via `llvm-readelf -l` (`0x4000`)
  - Signature: Verified v2 + v3 schemes with production certificate `CN=BillZen Beta`, SHA-256: `becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`

- **Signed Production Update Manifest**:
  - Location: `dist-android/android-update.json`
  - Pinned Public Key: `pNYmOtwIbds59TbdaplsW2JVTXoYl/piCQSu/crdg60=`
  - Key ID: `billzen-android-v1`, Channel: `stable`
  - Signature verified against pinned Ed25519 public key.

- **Automated Regression Suites**:
  - `npm test`: 43 passed across 7 files.
  - `cargo test --manifest-path src-tauri/Cargo.toml`: 89 passed (67 unit + 14 cashbook + 3 recovery + 5 update manifest tests).
  - `node --test scripts/release/tests/*.mjs`: 7/7 passed.
  - `npm run test:cashbook-pdf`: 3/3 passed.
  - `npm run test:theme`: 104/104 passed.

## 2026-10-20 — Phase UI-2 / UI-2.1: Precision Ledger Dashboard Migration & Correctness Pass

- **Scope & Delivery**:
  - `src/components/DashboardView.tsx` migrated to Precision Ledger design tokens (`var(--brand-primary)`, `var(--brand-lime)`, `var(--bg-canvas)`, `var(--bg-surface)`).
  - Explicit Account & Date Scope: When "All Accounts" is active, display all active accounts and ensure sum strictly equals closing balance. When a specific account is filtered, strip displays only the selected account with `(filtered)` badge so it never contradicts the single-account closing total. Explicitly renders `[Archived]` indicator for archived accounts when selected.
  - Honest Loading & Error Handling: Eliminated unverified fallbacks. Skeletons (`···` / `Loading…`) and error retry banners render when queries are pending or fail; no fake zero balances (`0.00`) are shown on query error.
  - Accessible HTML/CSS Bar Visualization: Semantic bars (`role="graphics-symbol"`, `tabIndex={0}`, focus rings, descriptive `aria-label`). Zero-value inflows/outflows render with strictly `height: 0%`.
  - Comprehensive Localization: Added 17 new translation keys across English, Malayalam (`ml`), and Arabic (`ar`).
- **Automated Verification Matrix**:
  - `npm test`: 70/70 Vitest unit/behavioral tests passing across 12 files (including 13/13 in `src/components/DashboardView.test.tsx`).
  - `npm run test:dashboard`: 9/9 Playwright scenarios passed (25/25 assertions).
  - `npm run test:responsive`: 6/6 viewports passed with 0px horizontal scroll (320px, 360px, 390px, 412px, 768px, 1280px).
  - `npm run test:theme`: 104/104 computed WCAG AA contrast checks passed with 0 failures and 0 overflow.
  - `npm run test:layout`: 906/906 layout matrix checks passed across 10 viewports, 3 languages, and light/dark modes.
  - `npm run test:native-cashbook`: 39/39 native assertions passed across 13 steps on temporary SQLite database using standalone release executable.
- **Rebuilt Linux Standalone Executable**:
  - Path: `src-tauri/target/release/billzen` (v0.1.2)
  - SHA-256: `41c83acc495d24e5cb3c0b3da9b800c593233effa714c4d92463296317e7621e`
  - Exact Size: 20,665,016 bytes (19.71 MB)

## 2026-10-20 — UI-3 Cashbook continuation

Baseline UI-2.1 commit `aa118aa` is confirmed on GitHub; CI [39381822767](https://github.com/MohammedJabir18/BillZen/actions/runs/39381822767) completed successfully.

UI-3 migrates Cashbook to the existing semantic Precision Ledger design, responsive/RTL layouts, localized screen copy and accessible nested dialogs. See [design and review evidence](design/cashbook-ui3.md). A browser reproduction also caught the pre-existing Dashboard payment shortcut's stale classification; both shortcuts now initialize through the normal Cashbook entry flow. Domain/adapters/schema/print/updater contracts are unchanged.

Verified locally during the migration:
- Frontend unit suite: 70/70 across 12 files; production TypeScript/Vite build passed.
- Dashboard: 25 assertions across 9 scenarios; responsive: 6 viewports.
- Cashbook: all 12 receipt/payment/reversal/negative-confirmation/print/backup steps.
- Cashbook/invoice PDF isolation: all 3 scenarios, including A4 geometry and cross-document text isolation.
- Computed theme/contrast: 104/104 states; full layout: 906/906 states, zero failures.

The 906/104 gates ran after visual/dialog corrections; final shortcut initialization and dialog-local error feedback received targeted final regression runs recorded below. An earlier parallel test attempt was invalidated by concurrent `dist/` regeneration; final broad browser gates were serialized. First contrast run found 4.44:1 dark payment text; the corrected dark coral passed the full contrast gate. Initial PDF test hit late guide appearance; the harness now isolates guide-completed state without disabling onboarding product behavior.

Final targeted/browser/native results, Linux hash and GitHub delivery are appended after completion. Existing build warnings remain: large frontend chunk and ineffective mixed static/dynamic imports. These are warnings, not failed compilation.

Final acceptance after shortcut/error-feedback corrections:
- `npm test`: 70/70 passed.
- `npm run test:cashbook-ui`: 55 browser assertions passed, including Malayalam/Arabic, 320px populated balances, 3-decimal KWD, dialog focus/background restoration, invalid-amount feedback and successful Dashboard Add Payment posting.
- `npm run test:cashbook`: all 12 steps passed again; `npm run test:cashbook-pdf`: all 3 PDF scenarios passed again; Dashboard: 25 assertions across 9 scenarios passed again.
- Linux rebuilt from the final UI source; `npm run test:native-cashbook`: 39/39 assertions passed, including cold restart, negative confirmations, idempotency and unchanged real-database fingerprints. Physical printer invocation was not exercised; native preview DOM and generated PDFs were checked.
- Executable: `src-tauri/target/release/billzen`, version 0.1.2, 20,669,112 bytes, SHA-256 `77ee980e39cec2086bd5857b86163f7a88d75b14f45d4628226eaf284d4a7edc`.
- Frontend main JS: 655.82 kB / gzip 164.76 kB in the release build. No new dependency or runtime cloud service.
- Mandatory Graphify semantic/Obsidian update could not finish: no semantic API key. Local `--code-only` fallback refreshed `graphify-out/graph.json` to 1,448 nodes / 3,018 edges. SQL extraction remains unavailable (`tree_sitter_sql` missing); this is not a full semantic/vault refresh.
- Android APK/signing/versionCode unchanged. No GitHub application release, updater manifest or installer was published. Windows/macOS/iOS/Android native acceptance remains outside this Linux/browser section.
