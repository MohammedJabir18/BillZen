# Dashboard, Analytics & Reporting Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the owner-approved Today's receipts/payments dashboard, optional analytics, period/custom reports, A4 PDF/CSV exports, and parity-tested calculation engine, after correcting CI responsive tests, update fallback safety, and release documentation.

**Architecture:** A unified cashbook reporting calculation contract implemented identically across Rust SQLite and TypeScript IndexedDB; React 19 UI adopting the approved visual mockup (`docs/mockups/2026-10-20-dashboard-reports-v1.html`) with "Today" as the default landing view; isolated print/export engine for complete A4 PDFs and injection-safe CSVs; strict non-accounting terminology (cash liquidity vs profit); and automated cross-platform verification.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS, Tauri 2.12, SQLite 3 (WAL mode via rusqlite), IndexedDB (`BillZen_Web_DB`), Poppler (`pdfinfo`/`pdftotext`), Playwright.

**Spec:** `docs/reviews/2026-10-20-updates-and-reporting-readiness.md` and approved mockup `docs/mockups/2026-10-20-dashboard-reports-v1.html`.

## Global Constraints

- Default landing view: "Today" in configured business timezone (`getTodayBusinessDate(timezone)`).
- Visual direction: Strict parity with approved mockup `docs/mockups/2026-10-20-dashboard-reports-v1.html` (minimalist, clean, non-decorative, no heavy 3rd-party chart libraries).
- Non-accounting terminology: Net cash movement is labeled as cash change / liquidity, **never "profit"**. Capital injections and loans are classified distinctly and never treated as sales revenue.
- Parity rule: SQLite worker (`src-tauri/src/db/worker.rs`) and IndexedDB adapter (`src/adapters/web_cashbook_db.ts`) must produce identical summary and ledger results for the same dataset and filter parameters.
- Durability: 100% offline-first, local SQLite on desktop/mobile, local IndexedDB on web fallback; zero business data transmitted over network.
- Internationalization: English (`en`), Malayalam (`ml`), and Arabic (`ar`) with RTL layout support.
- Numerical bounds: Checked integer minor units bounded by `MAX_MONEY_MINOR` ($10^{11}$) and `MAX_TOTAL_MINOR` ($10^{14}$). Variable exponent support (2-decimal INR/AED/SAR/USD/EUR and 3-decimal KWD/BHD/OMR).
- Safe Export: PDF and CSV exports operate on the complete filtered dataset (never just the visible page); CSV implements formula injection guards.
- Security: Never extract credentials from another process's environment or memory. Do not commit secrets.

## Review Focus

1. **Review Fixture Parity**: Prior-day receipt ₹100, selected-day operating receipt ₹50, selected-day loan receipt ₹200, future receipt ₹300. Selected-day opening must be ₹100, period receipts ₹250, operating net ₹50, closing ₹350. Future transactions must not alter earlier closing balance. Non-matching search must not alter period receipts or opening/closing balances.
2. **Cross-Period Reversals**: A voucher created in Period 1 and reversed in Period 2 must not alter Period 1's historical closing balance. Period 2 includes the reversal movement on its own business date.
3. **Archived Account Scoping**: Including vs excluding archived accounts must correctly filter both opening balance accumulation and movement calculations across both native and web engines.
4. **CSV Formula Injection**: Leading characters `=`, `+`, `-`, `@`, `\t`, `\r` in text fields (notes, names, numbers) must be safely escaped with a prepended single quote `'` in CSV exports.
5. **Print Media Isolation**: Report PDF generation must mount exclusively the complete report table with repeated `thead` headers, pure white paper background, and zero UI navigation/shell leakage.

---

### Task 1: Correct Verification & Android Update Safety Gaps (Section 1)

**Files:**
- Modify: `scripts/verify_responsive_playwright.js`
- Modify: `src-tauri/src/commands/updates.rs`
- Modify: `docs/android-update-delivery.md`
- Test: `scripts/verify_responsive_playwright.js`, `cargo test --manifest-path src-tauri/Cargo.toml`

- [ ] **Step 1.1: Write failing test / check for responsive test on default non-product screen**
  Run `node scripts/verify_responsive_playwright.js` against current checkout and observe it fail or report `modalOpenedCleanly: false` when the landing screen is not Products.

- [ ] **Step 1.2: Navigate to Products tab before Add Product modal check**
  In `scripts/verify_responsive_playwright.js`, before inspecting `[data-testid="add-product-button"]`, navigate to Products:
  - If `vp.width < 1024`: click `[data-testid="mobile-tab-products"]`
  - If `vp.width >= 1024`: click `[data-testid="tab-products"]`
  Wait for `[data-testid="input-product-name"]` selector upon clicking Add Product. Retain all modal scroll, horizontal overflow, and RTL assertions unchanged.

- [ ] **Step 1.3: Verify responsive test passes across all 6 viewports**
  Run `npm run test:responsive` and confirm all 6 viewports (320px, 360px, 390px, 412px, 768px, 1280px) pass with zero overflow and modal verification intact.

- [ ] **Step 1.4: Remove production unsigned install-approved fallback in prepare_android_update**
  In `src-tauri/src/commands/updates.rs`, remove the fallback that read `directory.join("install-approved")` directly.
  Require `service.release` in memory with verified metadata:
  ```rust
  let release = service.release.lock().map_err(|_| "Update state unavailable")?
      .clone().ok_or("Download and verify the update first")?;
  let artifact = release.artifact.clone();
  tauri::async_runtime::spawn_blocking(move || updates::transport::verify_file(&apk, &artifact)).await.map_err(|e| e.to_string())??;
  ```
  If `service.release` is None, return `Err("Download and verify the update first".into())`.

- [ ] **Step 1.5: Reconcile release documentation in docs/android-update-delivery.md**
  Clarify that keystore credentials have been recovered and verified against certificate SHA-256 `becf5a076bb17161c01f992a0d4561ede07394fd413407084e83e7f0325d25e4`; Ed25519 manifest key pair is provisioned outside Git; and local APK/manifest files are distribution artifacts, not an active public feed until published as GitHub release assets.

- [ ] **Step 1.6: Run test suites and verify Section 1**
  Run `cargo test --manifest-path src-tauri/Cargo.toml`, `npm test`, and `node --test scripts/release/tests/*.mjs`. All must pass cleanly.

---

### Task 2: Reporting Calculation Engine & Native/IndexedDB Parity (Section 2)

**Files:**
- Create: `shared/fixtures/cashbook_reporting.json`
- Modify: `src/adapters/web_cashbook_db.ts`
- Modify: `src/adapters/web_cashbook_db.test.ts`
- Modify: `src-tauri/src/db/worker.rs`
- Modify: `src-tauri/tests/cashbook_worker_tests.rs`

- [ ] **Step 2.1: Create shared test fixtures in `shared/fixtures/cashbook_reporting.json`**
  Author JSON test cases:
  1. `fixture_review_baseline`:
     - Initial opening balance = 0
     - 2026-10-19: Inflow ₹100 (`amount_minor: 10000`, `operating_income`)
     - 2026-10-20: Inflow ₹50 (`amount_minor: 5000`, `operating_income`)
     - 2026-10-20: Inflow ₹200 (`amount_minor: 20000`, `loan_disbursement`)
     - 2026-10-21: Inflow ₹300 (`amount_minor: 30000`, `operating_income`)
     - Query 2026-10-20 to 2026-10-20:
       `opening_balance_minor`: 10000
       `period_inflows_minor`: 25000
       `period_outflows_minor`: 0
       `net_operating_cash_flow_minor`: 5000
       `closing_balance_minor`: 35000
     - Query 2026-10-20 to 2026-10-20 with search="NonExistent":
       `opening_balance_minor`: 10000
       `period_inflows_minor`: 25000
       `period_outflows_minor`: 0
       `closing_balance_minor`: 35000
       `matching_inflows_minor`: 0
       `matching_outflows_minor`: 0
       `matching_count`: 0
  2. `fixture_kwd_3decimal`:
     - Kuwaiti Dinar (exponent 3) with capital contribution (15.000 KD), operating expense (4.500 KD), and loan repayment (2.000 KD).
  3. `fixture_cross_period_reversal`:
     - Day 1: Inflow 1000
     - Day 2: Reversal of Day 1 voucher (outflow 1000)
     - Day 1 query: opening 0, inflows 1000, closing 1000
     - Day 2 query: opening 1000, outflows 1000, closing 0

- [ ] **Step 2.2: Write failing unit tests in `src/adapters/web_cashbook_db.test.ts`**
  Add unit tests reading `shared/fixtures/cashbook_reporting.json` and asserting:
  - `opening_balance_minor` equals prior-period accumulation + account openings
  - `net_operating_cash_flow_minor` counts only `operating_income` and `operating_expense`
  - `closing_balance_minor` excludes future transactions
  - Search filters leave period balances intact while setting `matching_*` totals
  Run `npx vitest run src/adapters/web_cashbook_db.test.ts` and verify test fails.

- [ ] **Step 2.3: Implement exact reporting calculation in `src/adapters/web_cashbook_db.ts`**
  In `fetchCashbookLedger` of `src/adapters/web_cashbook_db.ts`:
  1. Determine relevant accounts: `allAccounts.filter(a => filter.account_id ? a.id === filter.account_id : (filter.include_archived ? true : !a.is_archived))`.
  2. Compute `period_opening_balance`:
     - Base account opening: sum of `opening_balance_minor` of relevant accounts.
     - Prior movements: sum of `m.amount_minor` for relevant accounts with `m.business_date < filter.start_date`.
     - `period_opening_balance = base_opening + prior_movements`.
  3. Compute un-filtered period vouchers:
     - Filter `allVouchers` by relevant accounts, `v.business_date >= filter.start_date`, and `v.business_date <= filter.end_date`.
     - `period_inflows = sum(v.amount_minor where v.direction === 'inflow')`
     - `period_outflows = sum(v.amount_minor where v.direction === 'outflow')`
     - `net_operating = sum(v.direction === 'inflow' ? v.amount_minor : -v.amount_minor where v.classification in ('operating_income', 'operating_expense'))`
     - `period_closing_balance = period_opening_balance + period_inflows - period_outflows`
  4. Compute display-filtered entries:
     - Apply search, classification, party, category, payment_method filters to period vouchers.
     - If display filter active: compute `matching_inflows_minor`, `matching_outflows_minor`, `matching_count`.
  5. Assign all fields to `CashbookSummary`.

- [ ] **Step 2.4: Verify tests pass in `src/adapters/web_cashbook_db.test.ts`**
  Run `npx vitest run src/adapters/web_cashbook_db.test.ts` and confirm all tests pass green.

- [ ] **Step 2.5: Add parity tests to Rust backend `src-tauri/tests/cashbook_worker_tests.rs`**
  Add `test_cashbook_reporting_contract_parity` in `src-tauri/tests/cashbook_worker_tests.rs` loading the exact same review fixture and asserting identical numbers.
  Run `cargo test --test cashbook_worker_tests`.

---

### Task 3: Implement Approved Dashboard View (Section 3)

**Files:**
- Create: `src/components/DashboardView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/index.ts`
- Modify: `src/types/cashbook.ts`

- [ ] **Step 3.1: Define Dashboard interfaces & localized dictionary strings**
  In `src/i18n/index.ts`, add dashboard keys in EN, ML, AR:
  - `tab_dashboard`: 'Dashboard' / 'ഡാഷ്‌ബോർഡ്' / 'لوحة التحكم'
  - `today_summary`: "Today's Summary" / "ഇന്നത്തെ കണക്ക്" / "ملخص اليوم"
  - `money_received`: 'Money Received' / 'വന്ന പണം' / 'المقبوضات'
  - `money_paid`: 'Money Paid' / 'പോയ പണം' / 'المدفوعات'
  - `net_change`: 'Net Cash Change' / 'പണത്തിലെ മാറ്റം' / 'صافي التغير النقدي'
  - `closing_balance`: 'Closing Balance' / 'ബാക്കി പണം' / 'الرصيد الختامي'
  - `opening_balance`: 'Opening Balance' / 'ആരംഭത്തിലെ പണം' / 'الرصيد الافتتاحي'
  - `simple_view`: 'Simple View' / 'ലളിതമായ കാഴ്ച' / 'عرض بسيط'
  - `analytics_view`: 'Detailed Analytics' / 'വിശദമായ വിശകലനം' / 'تحليل مفصل'
  - `latest_transactions`: 'Recent Transactions' / 'അവസാന ഇടപാടുകൾ' / 'أحدث المعاملات'
  - `cash_breakdown`: 'Account Balances' / 'അക്കൗണ്ട് വിവരങ്ങൾ' / 'أرصدة الحسابات'
  - `btn_add_receipt`: '＋ Add Receipt' / '＋ വരവ് ചേർക്കുക' / '＋ إضافة قبض'
  - `btn_add_payment`: '＋ Add Payment' / '＋ ചെലവ് ചേർക്കുക' / '＋ إضافة صرف'
  - `cash_flow_notice`: 'Receipts − Payments = Net cash change. This is not business profit.' / 'വരവ് − ചെലവ് = പണത്തിലെ മാറ്റം. ഇത് ബിസിനസിന്റെ ലാഭം എന്നർത്ഥമല്ല.' / 'المقبوضات - المدفوعات = صافي التدفق النقدي. هذا لا يعبر عن أرباح المنشأة.'
  - `period_today`, `period_this_month`, `period_this_year`, `period_custom`, `period_to_date`.

- [ ] **Step 3.2: Implement `DashboardView.tsx` component**
  Build `src/components/DashboardView.tsx` structured as:
  1. Header / Top Bar:
     - Period title ("Today's Summary" / "This Month's Summary") + business date & timezone subtitle.
     - Segmented period switch: Today, This Month (period-to-date), This Year (period-to-date), Custom.
     - Previous / Next buttons (`←` / `→`) to step back/forward in time.
     - Account filter dropdown (All Accounts, or specific account).
  2. Mode Toggle:
     - "Simple View" (default) vs "Detailed Analytics".
  3. 4 Primary Summary Cards:
     - Money Received (`period_inflows_minor`, green)
     - Money Paid (`period_outflows_minor`, coral/red)
     - Net Cash Change (`period_inflows - period_outflows`)
     - Closing Balance (`closing_balance_minor`, featured card with light green / distinct dark background)
  4. Account Balances Row:
     - Per-account breakdown pills (e.g. Cash: ₹11,000, Bank: ₹25,000).
  5. Simple View Content:
     - Left panel: Latest 5 transactions with inflow/outflow icons, party name, category, payment method, formatted amount, and "View All ↗" button to Reports.
     - Right panel: "Cash Movement Explanation" table:
       - Starting Balance (`opening_balance_minor`)
       - ＋ Money Received (`period_inflows_minor`)
       - − Money Paid (`period_outflows_minor`)
       - ＝ Closing Balance (`closing_balance_minor`)
       - Action shortcuts: "↙ Record Receipt", "↗ Record Payment" invoking parent modals.
       - Explanatory footnote: "Receipts − Payments = Net cash change. This is not business profit."
  6. Detailed Analytics View Content:
     - Receipts vs Payments bar chart: CSS/SVG bars comparing inflows and outflows grouped by day or month with tooltips and legend.
     - Category Spending Breakdown: Sorted category bars showing percentage of total outflows and minor unit amounts.
     - Distinguishing loan/capital helper banner.

- [ ] **Step 3.3: Wire Dashboard in `src/App.tsx` as default primary tab**
  - Set default `activeTab = 'dashboard'`.
  - Add `<LayoutDashboard className="w-4 h-4" />` in desktop top navigation and mobile bottom navigation.
  - Wire shortcuts to open existing Receipt modal and Payment modal directly from Dashboard.
  - Ensure theme switching, RTL, offline indicators, and font rendering remain pristine.

- [ ] **Step 3.4: Write Vitest unit tests for Dashboard component & state**
  Create `src/components/DashboardView.test.tsx` verifying:
  - Default period is Today.
  - Cards render formatted amounts matching `CashbookSummary`.
  - Explanatory footnote renders without the word "Profit".
  - Mode switch toggles between Simple and Analytics.
  Run `npx vitest run src/components/DashboardView.test.tsx`.

---

### Task 4: Implement Reports View, Period Navigation & Export Engine (Section 4)

**Files:**
- Create: `src/components/ReportsView.tsx`
- Create: `src/components/PrintableReportDocument.tsx`
- Create: `src/utils/csv_export.ts`
- Create: `src/utils/csv_export.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/utils/print.ts`
- Modify: `src/i18n/index.ts`
- Create: `docs/diagrams/reporting-data-flow.spec.json`

- [ ] **Step 4.1: Implement CSV export utility with formula injection guard**
  Create `src/utils/csv_export.ts`:
  - `exportTransactionsToCsv(reportData: ReportData): string`
  - Formula injection defense: If a string cell starts with `=`, `+`, `-`, `@`, `\t`, `\r`, prepend a single quote `'`.
  - Proper escaping: wrap cells with commas, quotes, or newlines in double quotes, escaping existing quotes as `""`.
  - Header block: Business Name, Tax ID, Currency, Timezone, Date Range, Filter summary, Opening Balance, Total Inflows, Total Outflows, Closing Balance, Total Records.
  - Column headers: Date, Voucher Number, Party Name, Category, Account, Classification, Payment Method, Direction, Inflow, Outflow, Reference / Notes.
  - Write Vitest tests in `src/utils/csv_export.test.ts` testing formula injection strings (`=cmd|' /C calc'!A0`, `+123`, `@SUM`), special characters, and numeric formatting. Run `npx vitest run src/utils/csv_export.test.ts`.

- [ ] **Step 4.2: Implement Printable A4 Report Document**
  Create `src/components/PrintableReportDocument.tsx`:
  - Professional A4 portrait report layout.
  - Header: Business name, Tax ID, Address, Contact details, Generated Date, Report Period, Timezone, Currency.
  - Period Summary Box: Opening Balance, Total Receipts, Total Payments, Net Cash Change, Closing Balance, Number of Transactions.
  - Transactions Table: Repeated table headers (`thead { display: table-header-group; }`), `tr { break-inside: avoid; }`.
  - Table columns: Date, Voucher #, Party, Category, Account, Receipt, Payment.
  - Footer with page numbers and offline notice.
  - Embed in `src/App.tsx` inside `#active-printable-container` when `activePrintDocument?.type === 'report'`.
  - Update `src/utils/print.ts` with A4 print rules.

- [ ] **Step 4.3: Implement `ReportsView.tsx` component**
  Build `src/components/ReportsView.tsx`:
  1. Top Controls:
     - Period selector (Today, This Month, This Year, Custom Date Range).
     - Previous / Next period navigation.
     - Detail filters row:
       - Search input (voucher #, party, note)
       - Direction (All, Receipts Only, Payments Only)
       - Account filter (All, or specific account)
       - Category filter
       - Classification filter
       - Payment Method filter
  2. Actions:
     - "Print / Export PDF" (invokes dedicated print flow with isolated container)
     - "Export CSV" (triggers browser download of generated CSV file)
  3. Balance Summary Bar:
     - Opening Balance, Period Receipts, Period Payments, Closing Balance.
     - Filter banner when search or detail filters active: "Matching: N transactions · Receipts ₹X · Payments ₹Y".
  4. Complete Paginated/Scrollable Transactions Table:
     - Date, Voucher #, Party Name, Category, Account, Inflow (+), Outflow (-).
     - Empty state with clear guidance.

- [ ] **Step 4.4: Wire Reports tab in `src/App.tsx`**
  - Add `<FileText className="w-4 h-4" />` in desktop top navigation and mobile bottom navigation for Reports.
  - Support direct navigation between Dashboard ("View All ↗") and Reports tab.

- [ ] **Step 4.5: Generate Archify data-flow diagram**
  Create `docs/diagrams/reporting-data-flow.spec.json` and generate `docs/diagrams/reporting-data-flow.html` using `/home/jabir/.gemini/config/plugins/archify/skills/archify/bin/archify.mjs`.

---

### Task 5: Automated Acceptance, Version Bump & Release Preparation (Section 5)

**Files:**
- Create: `scripts/verify_dashboard_reports.js`
- Modify: `package.json`
- Modify: `release/version.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `docs/verification-status.md`
- Modify: `brain/architecture.md`
- Modify: `brain/sessions.md`

- [ ] **Step 5.1: Create automated Playwright verification suite `scripts/verify_dashboard_reports.js`**
  Author an automated acceptance gate testing:
  1. Default landing on Dashboard with "Today" period and current business date.
  2. Simple view 4 metric cards rendering exact values.
  3. Explanatory equation rendering without the word "Profit".
  4. Toggle to Detailed Analytics view and verify SVG bar chart and category breakdown.
  5. Navigation to Reports view, testing Day, Month, Year, and Custom date ranges.
  6. Detail filter: search and direction filtering, asserting period balance independence from filter matching totals.
  7. CSV export generation and formula injection guard verification.
  8. Printable A4 report generation and PDF text isolation (verifying table headers and zero UI contamination).
  9. Mobile viewport responsiveness (360px and 390px) and dark/light theme switching.
  Add `"test:dashboard": "node scripts/verify_dashboard_reports.js"` to `package.json`.

- [ ] **Step 5.2: Run full regression test matrix**
  Execute:
  - `npm test` (all frontend unit tests)
  - `cargo test --manifest-path src-tauri/Cargo.toml` (all backend tests)
  - `node --test scripts/release/tests/*.mjs` (release tests)
  - `npm run test:responsive` (all 6 responsive viewports)
  - `npm run test:theme` (104 contrast checks)
  - `npm run test:cashbook-pdf` (A4 & thermal PDF isolation)
  - `npm run test:dashboard` (new dashboard and reports gate)

- [ ] **Step 5.3: Bump version and versionCode**
  Advance version to `0.1.2` and versionCode to `1007` (strictly higher than existing `1005` bootstrap and `1006` test build):
  - `release/version.json`: `{"version": "0.1.2", "androidVersionCode": 1007}`
  - `package.json`: `"version": "0.1.2"`
  - `src-tauri/tauri.conf.json`: `"version": "0.1.2"`, `"versionCode": 1007`
  - `src-tauri/Cargo.toml`: `version = "0.1.2"`
  Run `node scripts/release/version.mjs` to assert version alignment.

- [ ] **Step 5.4: Rebuild release artifacts and sign update manifest**
  - Rebuild Linux release binary: `npm run tauri -- build --no-bundle`
  - Rebuild ARM64 release APK: `scripts/build_android_apk.sh aarch64`
  - Generate and sign production update manifest: `node scripts/release/manifest.mjs`
  - Verify signatures, 16 KB page alignment, and checksums.

- [ ] **Step 5.5: Commit and push per AGENTS.md, and update Second Brain**
  - Commit each completed logical section.
  - Push branch `main` to `origin` using existing configured authentication.
  - Inspect triggered CI run on GitHub.
  - Update `brain/sessions.md`, `brain/architecture.md`, and `docs/verification-status.md`.
  - Re-sync Graphify knowledge graph (`graphify . --obsidian --obsidian-dir ./brain --update --code-only`).
