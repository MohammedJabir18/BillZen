# Session Log

## 2026-10-18 - Project Initialization & Second Brain Setup
- **Goals**: Set up Second Brain architecture, persistent workflow protocols, and Graphify knowledge graph integration.
- **Completed Tasks**:
  - Initialized `brain/` directory structure.
  - Created `brain/sessions.md` for session logging.
  - Created `brain/architecture.md` for tracking system architecture, tech stack, data models, and endpoints.
  - Configured persistent agent rules in `.agents/rules/brain-workflow.md` and `AGENTS.md`.
  - Initialized and linked Graphify to `brain/`.
- **Decisions Made**:
  - Adopted dual-layer memory: structured markdown in `brain/` plus unified Graphify knowledge graph for AST & semantic cross-referencing.
  - Standardized Session Start (2-bullet summary) and Session End protocols.
- **Pending Tasks**:
  - [Completed in Session 2] Receive project requirements and feature specifications for BillZen.
  - [Completed in Session 2] Establish initial tech stack and repository structure.

## 2026-10-18 - Milestones M1 & M2: Offline SQLite Foundation & Desktop App Shell
- **Goals**: Implement Milestone 1 (M1: SQLite schema, migrations, DB worker, financial domain arithmetic, failure-injection rollback tests) and Milestone 2 (M2: Runnable Tauri 2 + Vite 8 + React 19 foundation, persistent business settings, single-instance lock, platform CSP, and native-print feasibility probe).
- **Completed Tasks**:
  - Established Node.js v22.23.3 LTS environment and Vite 8 + React 19.3.1 toolchain.
  - Configured `src-tauri` with Tauri 2.12.4, rusqlite 0.40.2 (WAL + synchronous=FULL), and strict CSP.
  - Implemented exact financial calculation engine with half-up rounding and checked integer arithmetic in both Rust (`src-tauri/src/domain/financial.rs`) and TypeScript (`src/domain/financial.ts`).
  - Added shared calculation test fixtures in `shared/fixtures/calculations.json` and verified parity across Vitest (5/5 passing) and Cargo test (13/13 passing).
  - Designed `v1_init.sql` schema with split triggers (`BEFORE UPDATE`, `BEFORE DELETE`, `BEFORE INSERT`), NULL-safe `IS NOT` comparisons, commercial snapshot immutability, single settlement status for zero-total invoices (`fully_paid`), and constraints.
  - Implemented dedicated background database worker thread using FIFO `mpsc` queue and synchronous `std::sync::mpsc` startup handshake.
  - Resolved OS-backed single-instance lock via `fs2` advisory flock; proven across multi-process test runs.
  - Configured Tauri 2 custom-command manifest in `build.rs` and window capability boundaries (`default.json` vs `unprivileged.json`).
  - Refactored `PrintFeasibilityProbe` into a three-stage empirical capability verification workflow (Invocation, Dialog Observation, Output Verification).
  - Verified business profile settings persistence across full worker and OS process restarts.
  - Successfully packaged application into Debian installer (`BillZen_0.1.0_amd64.deb`, 7.27 MiB) and verified standalone execution on host desktop.
- **Decisions Made & Refinements**:
  - Clarified that database worker thread eliminates internal lock conflicts, but does NOT eliminate external `SQLITE_BUSY` contention (mitigated by `busy_timeout = 5000ms`).
  - Single-instance locking backed by OS file lock (`flock`), preventing second instance while recovering immediately on process exit.
  - Print dialog capability reported as unverified until native dialog is physically observed by the operator.
- **Runtime Verification Evidence**:
  - `single_instance_lock`: PASSED (PID locking, second instance rejection with OS error 11, third instance recovery).
  - `database_worker_handshake`: PASSED (Inaccessible path fails at startup; valid path connects).
  - `capability_permissions`: PASSED (`main` window authorized; `unprivileged-window` denied).
  - `settings_persistence`: PASSED (Values persist across independent processes).
  - `frontend_tests`: PASSED (5/5 Vitest).
  - `backend_tests`: PASSED (13/13 Cargo test).
  - `native_print_invocation`: PASSED (`window.print()` dispatches cleanly).
  - `native_print_dialog_observation`: NOT RUN (Awaiting physical user screen interaction; manual steps documented).
- **Unfinished Tasks / Next Steps**:
  - User reviews M2 verification.
  - Milestone 3 (M3): Product catalog, categories, pricing, unit conversion, barcode indexing, and nonnegative tracked inventory movements.
  - Milestone 4 (M4): Draft invoice management, finalized commercial snapshots, payment allocations, and thermal/A4 receipt printing.

## 2026-10-18 - Foundation Corrections, Regional Foundation & Automated Verification
- **Goals**: Resolve PDF print output regression, automate end-to-end verification without requiring physical printer hardware, implement India & GCC regional foundations (variable currency exponents and multi-currency formatting), deliver cross-platform and statutory tax/e-invoicing matrices.
- **Completed Tasks**:
  - **Print Tree Isolation & Dedicated Printable Document**:
    - Created `src/components/PrintableInvoiceDocument.tsx` with semantic table layout, repeated headers, page-break avoidance, Malayalam script, and Arabic RTL support.
    - Updated `src/styles/globals.css` with explicit A4 portrait geometry (`594.96 x 841.92 pt`) and strict print media isolation (`body * { visibility: hidden !important; }`, `#printable-invoice-root { visibility: visible !important; }`).
    - Fixed `PrintFeasibilityProbe.tsx` to prevent UI controls, buttons, and simulated preview DOM from leaking into print output.
  - **Automated A4 PDF Generation & Regression Suite**:
    - Developed `scripts/verify_pdf_a4.js` executing Vite preview + headless Chrome `--print-to-pdf` + Poppler utilities (`pdfinfo`, `pdftotext`, `pdftoppm`).
    - Verified exact A4 dimensions (`594.96 x 841.92 pts`), single page count (1), zero probe UI leakage, and generated high-res visual preview (`test_artifacts/pdf/invoice_page-1.png`).
  - **Regional Foundation & Variable Currency Exponents**:
    - Implemented database migration `v2_regional_foundation.sql` adding `currency_exponent` and `locale` to `business_settings` and `invoices`.
    - Added trigger `trg_business_settings_prevent_currency_change_when_invoices_exist` preventing dangerous mid-history currency drifts.
    - Added 3-decimal currency test fixture (KWD) to `shared/fixtures/calculations.json`.
    - Implemented formatting and parsing helpers (`formatMinorUnits`, `parseToMinorUnits` in TS; `format_minor_units` in Rust) supporting both 2-decimal and 3-decimal currencies.
    - Updated `SettingsView.tsx` with regional currency presets (INR, AED, SAR, QAR, KWD, BHD, OMR).
  - **Documentation Deliverables**:
    - Created `docs/platform-support-matrix.md` detailing storage, single-instance locking, and printing subsystems across Linux, Windows, macOS, Android, and iOS.
    - Created `docs/tax-and-e-invoicing-matrix.md` detailing GST/VAT calculations, statutory identifiers (GSTIN, TRN, VATIN), ZATCA Phase 1/2 TLV encoding, and decoupled offline-first architecture.
  - **Test Suite Results**:
    - Vitest: 7/7 passed.
    - Cargo test: 14/14 passed.
    - Frontend build: Passed (`tsc && vite build`).
    - Automated PDF verification: PASSED (`test_artifacts/pdf/pdf_verification_report.json`).
    - Physical printing: `NOT RUN — hardware unavailable` (automated headless tests substituted).
- **Decisions Made**:
  - Quantity scaled factor ($1000$) combined with native integer minor units preserves arithmetic parity identically for 2-decimal and 3-decimal currencies.
  - Commercial billing remains completely offline and unblocked by network availability; statutory e-invoicing is handled by asynchronous background queue.
- **Pending Tasks / Next Steps**:
  - [Completed] Financial data integrity patch, input parsing & calculation fixes, printable DTO view-model binding, and Playwright matrix verification.
  - Milestone 3 (M3): Product catalog, categories, pricing, unit conversion, barcode scanner input, and opening stock movements.

## 2026-10-18 - Financial Data Integrity, Strict Calculations & Playwright Matrix Verification
- **Goals**: Resolve financial data integrity edge cases, enforce domain currency validation, harden input/calculation helpers against float drift and improper parsing, bind printable invoice amounts to calculated DTO view models, and automate multi-scenario A4 matrix verification via Playwright without physical printer dependency.
- **Completed Tasks**:
  - **Migration v3 & Invariant Protection**:
    - Created `src-tauri/src/db/migrations/v3_protect_currency_exponent.sql` updating `trg_prevent_finalized_invoice_update` to include `snapshot_currency_exponent IS NOT OLD.snapshot_currency_exponent`.
    - Added integration test `test_upgrade_populated_v2_database_to_v3` proving finalized exponent mutations are rejected while legitimate payment settlement updates succeed.
  - **Rust Domain Currency Validation & Safe Switching**:
    - Created `src-tauri/src/domain/currency.rs` validating supported ISO 4217 currencies and exact exponents (`INR: 2`, `AED: 2`, `SAR: 2`, `QAR: 2`, `KWD: 3`, `BHD: 3`, `OMR: 3`, `USD: 2`, `EUR: 2`, `GBP: 2`).
    - Guarded base currency switching in DB worker: switching is strictly rejected if products, invoices, payments, or expenses exist in the database.
  - **Calculation & Input Helpers Fixes**:
    - Fixed negative minor unit formatting in TS (`formatMinorUnits`) and Rust (`format_minor_units`) preserving negative sign (`-50` at exp 2 becomes `"-0.50"`).
    - Hardened `parseToMinorUnits` and `parse_to_minor_units` with strict regex validation: standard 3-digit comma grouping (`1,000.00`), Indian lakh grouping (`1,00,000.00`), excess precision rejection (`1.999` with exponent 2 rejected), and alphanumeric rejection (`12abc.34` rejected).
    - Rewrote line item arithmetic using `BigInt` to eliminate floating-point drift and verified bounded numeric limits (`MAX_MONEY_MINOR = 10^11`, `MAX_QUANTITY_SCALED = 10^9`).
  - **Printed Document Calculated View-Model Binding**:
    - Implemented `createInvoiceViewModel` and independent oracle test verifying line totals (`₹224.20`, `₹349.19`), subtotal (`₹537.56`), discounts (`-₹15.00`), taxable subtotal (`₹522.56`), total tax (`₹50.83`), and grand total (`₹573.39`).
    - Connected `PrintableInvoiceDocument.tsx` exclusively to the computed view-model with data-driven tax labels (GST vs VAT).
  - **Playwright Matrix Verification (4/4 Scenarios Passed)**:
    - Built and executed `scripts/verify_matrix_playwright.js` verifying:
      1. `scenario_short_oracle`: 1 page, exact oracle totals, bilingual English/Malayalam/Arabic rendering.
      2. `scenario_multipage`: 22 items cleanly paginated across 3 pages with repeated table headers.
      3. `scenario_kwd_3decimal`: 1 page, 3-decimal Kuwaiti Dinar format (`KD 3.281`), VAT labels.
      4. `scenario_long_text`: 1 page, multi-line names, addresses, and descriptions wrapping cleanly without table overflow.
  - **Documentation & CI**:
    - Updated `docs/platform-support-matrix.md` and `docs/tax-and-e-invoicing-matrix.md` with official statutory references (CGST Act 2017, ZATCA Resolution 210917, FTA Decree-Law No. 8) and verified access dates.
    - Added `.github/workflows/ci.yml` running cargo tests, vitest tests, and production build on GitHub Actions.
- **Verification Evidence**:
  - Vitest: 11/11 tests passed.
  - Cargo test: 23/23 tests passed.
  - Production build: `npm run build` passed cleanly.
  - Playwright A4 Matrix Report: `test_artifacts/pdf/matrix_verification_report.json` (allPassed: true).
  - Physical printing: `NOT RUN — hardware unavailable`.
- **Pending Tasks / Next Steps**:
  - [Completed in Session 5] Milestone 3 (M3): Product catalog, categories, pricing, unit conversion, barcode scanner input, and opening stock movements.

## 2026-10-18 - Milestone 3: Catalog Domain, Inventory Ledger, Multi-Language & Scanner Verification
- **Goals**: Implement Milestone 3 (M3: Product & Customer Catalog, Categories, Pricing, Barcode indexing & preservation, Keyboard-Wedge Scanner support, Nonnegative tracked opening stock ledger movements, Bundled offline fonts, Trilingual UI localization, Playwright E2E verification).
- **Completed Tasks**:
  - **Numeric Contract & Universal Bounds**:
    - Aligned TypeScript and Rust financial engines to `MAX_SAFE_MONEY_MINOR = 9_007_199_254_740_991` (`Number.MAX_SAFE_INTEGER`).
    - Added checked `i128` intermediate gross calculation in Rust `round_half_up_128` to eliminate arithmetic overflow while maintaining exact integer accuracy.
    - Added boundary test fixtures in `shared/fixtures/calculations.json` verifying exact rejection and success boundaries across Vitest and Cargo.
  - **Database Schema & Migrations (`v4_catalog.sql`)**:
    - Created `categories` table with unique name index.
    - Extended `products` with `min_stock_threshold_scaled` and `category_id` FK.
    - Extended `customers` with `country` and `address_line2`.
    - Integrated SHA-256 migration runner and verified migration upgrade path `test_upgrade_populated_v3_database_to_v4`.
  - **Database Worker & Catalog Domain Operations**:
    - Implemented `Product`, `Customer`, `Category` DTOs and filters in `src-tauri/src/domain/catalog.rs`.
    - Implemented atomic opening stock movement insertion (`reference_type = 'opening'`) in `src-tauri/src/db/worker.rs`.
    - Protected inventory ledger immutability: `update_product` strictly omits `current_stock_scaled`.
    - Enforced uppercase SKU normalization and string barcode trimming preserving standard leading zeros (e.g. `"0012345678905"`).
    - Added comprehensive unit and integration tests (32/32 Cargo tests passing).
  - **Tauri IPC Command Handlers & Window Permissions**:
    - Created `src-tauri/src/commands/catalog.rs` exposing 12 commands: `get_products`, `create_product`, `update_product`, `archive_product`, `restore_product`, `get_customers`, `create_customer`, `update_customer`, `archive_customer`, `restore_customer`, `get_categories`, `create_category`.
    - Registered commands in `src-tauri/build.rs` `AppManifest` and `src-tauri/capabilities/default.json`.
    - Verified permission boundaries: `main` window allowed, `unprivileged` window denied.
  - **Offline Font Bundling & CSS Architecture**:
    - Copied `NotoSans-Regular.ttf`, `NotoSansMalayalam-Regular.ttf`, and `NotoSansArabic-Regular.ttf` to `public/fonts/`.
    - Added `@font-face` rules to `src/styles/globals.css` ensuring reliable 100% offline rendering without CDN or system font reliance.
  - **Frontend UI, Barcode Scanner & Trilingual Localization**:
    - Created `src/i18n/index.ts` supporting English (`en`), Malayalam (`ml`), and Arabic (`ar`) with dynamic RTL support (`dir="rtl"`).
    - Built `ProductCatalogView.tsx` featuring live search, category filter, low-stock filter, keyboard-wedge scanner Enter-recognition, and create/edit modal.
    - Built `CustomerCatalogView.tsx` featuring phone prefix preservation, tax ID display, address lines, and search.
    - Updated `src/App.tsx` tab navigation and language switcher.
  - **Playwright Automated Verification Suite**:
    - Created `scripts/verify_catalog_playwright.js` verifying UI loading, product creation, leading zero barcode preservation, keyboard-wedge Enter scanner feedback, customer contact preservation, and Malayalam/Arabic RTL rendering.
    - Captured visual artifacts in `test_artifacts/catalog/` (`catalog_products.png`, `catalog_customers.png`, `catalog_malayalam.png`, `catalog_arabic_rtl.png`).
    - Updated `.github/workflows/ci.yml` to run Playwright verification.
- **Verification Evidence**:
  - Vitest Unit Tests: 14/14 passed.
  - Cargo Tests: 32/32 passed.
  - Native Catalog Multi-Process Persistence Probe (`catalog_probe`): PASSED (Process 1 writes category, product with leading zeros, opening stock ledger, customer; quits; Process 2 relaunches, audits SQLite persistence, verifies duplicate rejections).
  - Production Frontend Build: `npm run build` passed.
  - Playwright Catalog E2E: `test_artifacts/catalog/catalog_verification_report.json` (allPassed: true).
  - Playwright A4 Print Matrix: 4/4 scenarios passed (`matrix_verification_report.json`).
- **Unfinished Tasks / Immediate Next Steps**:
  - Milestone 4 (M4): Draft invoice management, finalized commercial snapshots, payment allocations, and receipt printing.

