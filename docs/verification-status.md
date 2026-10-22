# Verification status

Review date: 2026-10-20. This file distinguishes local observations from product completion claims.

## Chart/screen motion continuity — 2026-10-22

- Reproduced overlapping animation ownership: browser traces showed inline bar scale0 while computed scale remained1 with CSS transition-all; origin initially sat at half height. Removed transform/height CSS interpolation, fixed bottom origin before scaling and removed per-bar delay. Summary/data entrances do not replay during routine filters/refetches; new chart groups remain eligible for entry.
- Reports/Products/Customers/Settings now have scoped section entrances; product/customer modal panels share the existing dialog hook. Fixed modal ancestors remain untransformed. Existing navigation, Cashbook dialogs, keyboard/reduced-motion handling and immediate dismissal retain their contracts.
- Regression red:19/21 scenarios passed, with CSS ownership and missing screen entrance checks failing. Final:22/22 motion checks passed, including intermediate computed-versus-inline scale, fixed baseline, zero-to-height progression, zero-valued bar, rapid filters, period group replacement, four screens, keyboard, live reduced motion, responsive navigation and RTL themes. Unit72, Reports68, catalog workflow, quick responsive104 and theme96 checks passed. Production build passed with existing chunk/mixed-import warnings. Browser data is synthetic; no hardware FPS claim.
- Rebuilt Linux executable passed39 isolated native assertions and atomically refreshed the existing per-user installation with a retained backup. Standalone/installed SHA256:`edb5c7e3be5b7fbd0884d69b7360b18bd313d4864f4d1802583aad12ddc3966a`. Previously packaged APK/Windows/deb/AppImage files are not changed by this source section; no GitHub release/feed promotion.

## Verified v0.1.4 build delivery — 2026-10-22

- Source39d6b99 (0.1.4/Android1009) and motion sourceb19430b both passed full GitHub CI. Hosted Windows39820175490 succeeded; downloaded x64 setup passed source/hash/size and canonical icon verification. Unsigned beta; physical Windows runtime untested.
- Linux executable and deb/AppImage built. Standalone and actual packaged AppImage each passed39 native assertions with isolated temporary databases, cold restart and real-data fingerprints. AppImage first restart attempt failed after26 checks because the standalone harness killed only the launcher; a temporary process-group harness rerun passed39 without changing app/package bytes. The AppImage bundled ELF's adjusted RUNPATH explains its different hash. Existing per-user Linux launcher binary refreshed atomically with a backup; no business records relocated/changed.
- ARM64 distribution APK retains original certificate/public pin; actual package/version1009/ABI/minSDK, signatures,16KB zip/ELF alignment, embedded assets/fonts and disabled distribution WebView debugging passed. Original signing access was used only after the owner's explicit approval; no secret values were written to Git, prompts or output. Resolved the automatic approval review's prior credential-source objection through that explicit authorization.
- Internal x86_64 test APK upgraded the dedicated AVD1008→1009 in place:22 assertions passed, preserving company/accounts/categories/parties,5 synthetic vouchers,1 product,1 customer and preferences. Settings Malayalam/Arabic, populated Reports and cold restart passed. An interrupted build was resumed before installing; no uninstall/storage clear. Physical ARM64 handset and fresh signed-feed installer handoff remain untested.
- Exact shareable paths, sizes and SHA256 values are in `docs/distribution-v0.1.4.md` and ignored distribution build-info/checksum files. No public v0.1.4 release, update manifest/feed promotion or desktop updater configuration was published. Source push/build alone is not automatic delivery to existing recipients. macOS/iOS packaging outside this request.
- Local metadata guard against code1008,3 release-contract test files and72 unit tests passed. Semantic Graphify sync lacks an API key; code-only refresh1508nodes/3127edges succeeded; SQL parser remains unavailable.

## Drawer/dialog entry section — 2026-10-22

- More drawer:220ms/12px; shared Cashbook dialog panels:240ms/8px; opacity0.85→1, `power3.out`. No deferred close, form submission, focus, inert/scroll-lock or print behavior changes. Other modal families retain existing behavior.
- Added shared ref-counted keyboard/pointer modality tracking, entry-only scoped/reversible effects, immediate keyboard/reduced-motion handling and live preference settling without replaying an already visible panel. Fixed universal reduced-motion transition duration from0.01ms to0s after observing inline final transforms while computed styles still interpolated.
- Test-first:before implementation, the drawer/dialog positive-entry checks failed (16/18 existing/new scenarios passed). Final motion19/19 passed, including MutationObserver opening traces, nested focus/scroll-lock, keyboard/reduced motion and simulated Android Back dismissal. No physical Android claim. Unit72, Cashbook UI55 and slow-category Reports UI68 passed. Build720.42kB/gzip193.83kB, existing chunk/import warnings remain.
- Full layout816 states passed with original bounds assertions after waiting for actual panel settlement; initial quick audit9 failures had measured entry travel. Final reduced-motion CSS follow-up uses the quick104-state matrix. Settled theme96 states passed, and PDF suite passed. Screenshots:ignored `test_artifacts/motion/drawer-open.png`, `receipt-dialog.png`; synthetic data only. No device FPS/native runtime/physical printer validation.
- Prior source CI39815498589 failed on Arabic Reports category identity. Reproduced the same assertion deterministically with delayed synthetic category reads; corrected the test to wait for the selected option/refetch and rendered rows rather than capture a transient empty value or sleep150ms. Assertions remain intact; CI now exercises the slow-read fixture. Cashbook validation-alert assertion also waits for the rendered alert. A first naive timer-only fault probe lost the IndexedDB transaction-completion event; replaced it with a transaction-preserving keepalive before drawing conclusions.
- Independent final review found no actionable implementation issue; its short-animation sampling concern was resolved with browser-side traces. One-frame/timer-sensitive reduced-motion observations led to actual-render-frame synchronization and the zero-duration CSS correction. No database/schema/domain/signing/updater/version or installed artifact changed. New source CI result must be reported separately.

## Hermes motion continuation — 2026-10-22

Independently checked Hermes's repaired working tree, reproduced remaining defects, and completed the repair. Mobile label/icon layering, live reduced-motion cancellation, keyboard More selection and long-press geometry were still broken. Shared owned/cancellable hooks now handle navigation and summary/chart effects; original Cashbook amount wrapping/copy was restored. Independent final static review found no remaining actionable finding.

Observed final verification:

- Production build passed; main JavaScript 719.76 kB / gzip193.60 kB. Existing chunk-size/mixed-import warnings remain. No device FPS benchmark claimed.
- Frontend unit tests:72/72 in12 files.
- New real-browser motion suite:14/14 scenarios. Covers long press, keyboard primary/More, live reduced motion for navigation/cards/nonempty analytics, rapid routes/filters, responsive hidden navigation, More selection and animated RTL in light/dark themes. A synthetic125.50 receipt confirms visible Dashboard money and positive/zero chart geometry. Added to browser CI.
- Cashbook UI:55/55 and Reports UI:68/68 passed sequentially on final code. Earlier resource-heavy parallel verification failed on Malayalam alert visibility and a Reports submit timeout; sequential reruns passed without weakening assertions. These remain useful timing observations, not silently discarded passes.
- Full layout matrix:816 states, zero failures across10 widths,3 languages and both themes. Quick preliminary matrix:104 states, zero failures.
- Theme contrast:96 states passed, zero reported contrast/overflow failures. This audits settled solid-color text, not complete accessibility or every animation frame.
- Cashbook PDF suite:passed, including voucher/invoice separation and A4 checks. Physical printing not tested.
- `git diff --check`:passed. Local screenshots/JSON under ignored `test_artifacts/motion/`; earlier failing reproductions retained in temporary logs.

All browser data was isolated/synthetic. No native database, calculation/schema, signing/updater configuration, version or release asset changed. Native Linux/Windows/Android runtime and physical-device performance were not verified for this source section; existing executable/APK/installers still require separate builds. Drawer/dialog expansion remains a later section, not part of the completed stability claim. Graphify semantic sync lacks an API key; code-only refresh succeeded1493nodes/3091edges, SQL parser unavailable.

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

## 2026-10-20 — UI-4 Reports / Settings language

The previous UI-3 commit's GitHub CI succeeded. UI-4 removes language/platform controls from the shared header and the implementation-diagnostic footer. Language is now changed in Settings and persists through the existing device preference. Reports use the approved semantic design, named controls, readable narrow/RTL amounts, honest loading/error/date validation, correct category identity and human-readable category names in screen/CSV/PDF output. See [UI-4 design evidence](design/reports-ui4.md).

Observed local verification: 72 frontend tests, 14 Settings/header assertions, 68 Reports assertions (including filtered CSV, invalid ranges and genuine A4 PDF/category-name extraction), 906 layout states, 104 theme checks, 6 responsive viewports, Dashboard25 assertions, catalog localization, onboarding and all four invoice PDF scenarios passed. No physical printer was invoked. Readiness regression verifies a ready ledger cannot export until category names resolve. Native Linux and Android packaging/acceptance follow in the next section; this UI section alone does not certify native Android.


## 2026-10-21 — Versioned UI-4 Android/Linux candidate

UI-4 commit `2484a89caf12a133cd534e74d9180194dd2a0fde` matches origin/main; [CI 39388863149](https://github.com/MohammedJabir18/BillZen/actions/runs/39388863149) succeeded. Version metadata now aligns at 0.1.3/code1008, above distributed code1007.

Final acceptance: frontend72 tests, release-contract3 files, Android22 assertions (code1006 →1008 data comparison, Settings language, responsive Arabic Reports, cold restart), Linux39 native assertions. All passed. Native tests use isolated synthetic data; no uninstall/data clear or real-business-data mutation. The first Android automation run stalled after a session interruption; a bounded progress-reporting rerun completed. Saved test baseline was preserved.

See [candidate identity, hashes and scope](android-v0.1.3-candidate.md). ARM64 distribution is signed by the original certificate, retains the updater public pin and disables WebView debugging. APK hash/size and signed Ed25519 metadata were independently matched. No public release, tag or installer upload was performed; source CI alone does not distribute updates. Physical ARM64 and a new signed-feed installer handoff remain unverified in this section.

Graphify semantic/Obsidian refresh was attempted but requires an unavailable semantic API key. Code-only fallback succeeded: 1,466 nodes /3,055 edges, 112 communities. SQL extraction remains unavailable (`tree_sitter_sql` missing). This is not a full semantic/vault refresh.


## 2026-10-21 — Owner-authorized Android release published

Published [v0.1.3](https://github.com/MohammedJabir18/BillZen/releases/tag/v0.1.3) as the latest non-draft/non-prerelease release at 16:22:07 UTC (21:52:07 IST), targeting `99239635db043b0d2bf239461306a5ff4770eb02`. That source commit's CI39631174172 succeeded. Remote v0.1.3 tag matches it.

Uploaded only ARM64 distribution APK, `android-update.json` and `SHA256SUMS.txt`; no automation APK, keys, database or business records. GitHub asset digests matched local files before publication. After publication, unauthenticated HTTPS downloads from the exact app latest-feed URL and signed APK URL succeeded. The downloaded manifest's Ed25519 signature verified against the app public pin; its package/channel/code1008, APK size/hash and byte-for-byte equality with the local signed candidate passed.

Release notes: `docs/releases/v0.1.3.md`. This verifies public distribution bytes, not a new on-device installer handoff or physical ARM64 acceptance. Desktop updater metadata/installers are not published by this Android release. Future source pushes alone still do not distribute signed updates.


## 2026-10-22 — Remove customer-facing Print Feasibility Probe

Owner asked what the diagnostic screen does and requested removal if unnecessary. It was an engineering utility for print invocation, manual native-dialog observation and output confirmation; it is not required for business entry or actual Reports/voucher printing.

Removed the component, desktop/mobile destination, legacy tab selection and obsolete translations; desktop navigation now has six columns. Automated invoice PDF fixtures use explicit synthetic scenario URLs without displaying a diagnostic screen. Updated obsolete test interactions rather than removing PDF/print coverage. The native theme check now exercises normal Reports controls. Print-support backend diagnostics remain available to engineering tools; no database/domain/updater changes.

Observed regression: added navigation absence assertion failed against the previous build, then passed after removal (17 header/Settings checks). Final frontend72 tests, 3 cashbook/invoice PDF isolation scenarios (A4 and80mm), all4 invoice matrix scenarios, onboarding34, quick layout104 states and theme96 states passed. Fewer layout/theme cases reflect deletion of the diagnostic screen, not reduced coverage of the remaining six destinations. Independent static review found no actionable regressions.

Linux executable rebuilt successfully; native39 assertions passed with isolated test data, including cold restart and unchanged real-data fingerprints. Path `src-tauri/target/release/billzen`, 20,671,560 bytes, SHA-256 `219d1486377ba75707359e3eacdf7dda3d0ee9db0539ada386df118cfb299596`. This is a local v0.1.3 rebuild with the removal; the published immutable Android v0.1.3 APK is unchanged. Android requires a future higher-code signed release to receive this source change; no new APK/release published in this task. No physical printer test claimed.


## 2026-10-22 — Linux installation and Windows friend installer

Installed the native39-tested Linux build per-user to `~/.local/opt/billzen/billzen`, with BillZen icon and `~/.local/share/applications/billzen.desktop`. Desktop entry validates, installed executable byte-compares equal to the verified source build; hash219d1486377ba75707359e3eacdf7dda3d0ee9db0539ada386df118cfb299596. Application data was not moved/cleared.

New manual Windows workflow source commit3429893 pushed/confirmed on origin. [Run39775472312](https://github.com/MohammedJabir18/BillZen/actions/runs/39775472312) succeeded: frontend tests, Windows native release compilation and NSIS installer packaging. Downloaded `dist-desktop/windows/v0.1.3/BillZen_0.1.3_x64-setup.exe`,5,363,984bytes, SHA25694143328dacab8e90fa6d95e7865ebe92a779dc4f945cad1cdd3f16d26fdf5db. Hash/size/PE signature/provenance verified locally. Only installer/checksum/build-info uploaded; no databases/keys. Generated desktop artifacts are ignored. Static workflow review found no important issue.

Packaging success is distinct from Windows runtime acceptance. Installer is not code-signed; no physical Windows app/printing check or desktop automatic updater setup is claimed. No public Windows release asset published. Hosted run's Node20-action deprecation warning is non-fatal; actions ran under Node24. See `docs/desktop-installation.md` for user instructions and limitations.

Source CI39775452548 for3429893 completed successfully.


## 2026-10-22 — Desktop branding correction

Linux GTK icon lookup reproducedNOT FOUND for the name-only launcher. Canonical PNG was correct. Installed launcher now uses an absolute icon path; added missing user hicolor index and refreshed cache. Gio loads the file icon, GTK resolves the named icon, desktop validation passes and installed PNG digest matches source. This proves icon resolution rather than a captured GNOME screenshot; reopening the applications menu may be required for its cached view.

Original Windows setup failed a new real PE resource comparison. Configured NSIS installer/uninstaller icons explicitly, added a package-free resource verifier and gated workflow upload on matching app/setup icon frames. Tauri config validates against installed JSON schema; Python/YAML/whitespace checks passed. Independent static review found no important issue.

[Windows run39778796695](https://github.com/MohammedJabir18/BillZen/actions/runs/39778796695), source6abdf93, succeeded including frontend tests and all6 canonical icon-frame matches in both application and setup PE resources. Downloaded installer independently passes the same comparison locally. Its source, size5,348,901bytes, SHA2566ab698cdbe9ba66282e0c6445e34b228ccdde246059817027a9a6fdb7833a67a and iconVerified metadata match. The previously shared local `dist-desktop/windows/v0.1.3` path is refreshed; original installer archived under `v0.1.3-before-icon-fix`.

No physical Windows shell/runtime or printer acceptance claimed. Still unsigned; no public Windows/Android release changed, no signing identity or data mutation. Linux installed executable itself is unchanged; correction is desktop icon metadata/cache.
