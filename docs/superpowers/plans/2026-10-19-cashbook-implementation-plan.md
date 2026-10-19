# BillZen Offline Company Cashbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 100% offline-first company cashbook for recording money received and paid, maintaining numbered vouchers, running account balances, voucher printing, and safe portable backup/restore.

**Architecture:** Domain logic with 64-bit integer minor unit arithmetic and exact half-up rounding implemented in both Rust and TypeScript; dual-platform persistence via SQLite worker thread on Native (Desktop/Android) and persistent IndexedDB on Web; strictly isolated from invoicing until Phase C4.

**Tech Stack:** Rust 1.99.0, rusqlite 0.40.2 (WAL mode), Tauri 2.12.4, React 19.3.1, TypeScript 5.8.2, Vite 8.3.4, Tailwind CSS 3.4.17, Vitest, Cargo test.

**Spec:** `docs/cashbook-architecture-spec.md`

## Global Constraints
- Single-operator local use on an independent device; zero cloud sync, zero staff login roles, zero multi-device auto-merging.
- Net cash flow ($\text{Inflows} - \text{Outflows}$) and accumulated account balances must NEVER be labeled as "Profit".
- Exact integer minor unit math; `MAX_MONEY_MINOR = 10^11` ($100,000,000,000$), `MAX_TOTAL_MINOR = 10^14` ($100,000,000,000,000$).
- All balances fit safely within JavaScript `Number.MAX_SAFE_INTEGER` ($2^{53} - 1 \approx 9 \times 10^{15}$).
- Dual platform durability: Native SQLite (WAL + synchronous=FULL) and Web IndexedDB (no ephemeral in-memory mocks).
- Never copy an uncheckpointed, active WAL `.db` file; restore requires pre-validation, temporary staging, and recovery copy.
- Voucher numbering strictly follows `{PREFIX}-{YYYYMM}-{SEQUENCE:05d}` (e.g. `RCP-202610-00001`).

## Review Focus
1. Double-cancellation prevention: Both original and reversal movements must exist in the ledger summing to zero; queries must NOT exclude reversed vouchers from balance sums.
2. Idempotency collisions: Reusing the same `idempotency_key` with a different payload must produce a `409 Conflict` error rather than silently returning an existing record.
3. Currency change prevention: Once any non-zero account or posted voucher exists, changing business base currency code or exponent must be rejected by database triggers.
4. Backdated deterministic order: Ledger sorting must strictly use `(business_date ASC, sequence_number ASC, id ASC)` to prevent chronological drift.
5. Large integer transport: Ensure amounts up to `MAX_MONEY_MINOR` traverse Tauri IPC and JSON serialization without floating-point truncation.

---

## Task Breakdown (Milestone C1)

### Section C1A: Schema, Domain & Native Posting Service

- [ ] **Task C1A.1: Database Migration `v7_cashbook_foundation.sql`**
  - **Files:**
    - Create: `src-tauri/src/db/migrations/v7_cashbook_foundation.sql`
  - **Details:**
    - Create tables: `money_accounts`, `cashbook_categories`, `cashbook_parties`, `cashbook_vouchers`, `cashbook_movements`, `cashbook_sequences`, `cashbook_audit_events`.
    - Implement trigger `trg_prevent_posted_voucher_update`: blocks modifications to posted voucher amounts, dates, accounts, and snapshot columns.
    - Implement trigger `trg_prevent_posted_voucher_delete`: blocks row deletions of posted vouchers.
    - Implement trigger `trg_cashbook_prevent_opening_balance_update_when_movements_exist`: blocks changing `money_accounts.opening_balance_minor` once movements exist.
    - Upgrade trigger `trg_business_settings_prevent_currency_change_when_financial_records_exist` to include cashbook vouchers and non-zero accounts.
    - Register migration in `src-tauri/src/db/migrations/mod.rs` with exact SHA-256 checksum tracking.
  - **Verification:**
    - Run `cargo test --manifest-path src-tauri/Cargo.toml test_migration_v7` to verify forward migration and table creation.

- [ ] **Task C1A.2: Rust Domain & Arithmetic Engine**
  - **Files:**
    - Create: `src-tauri/src/domain/cashbook.rs`
    - Modify: `src-tauri/src/domain/mod.rs`
  - **Details:**
    - Define domain structs: `MoneyAccount`, `CashbookCategory`, `CashbookParty`, `CashbookVoucher`, `CashbookMovement`, `CashbookClassification`, `MovementDirection`.
    - Implement checked arithmetic helpers: `validate_money_amount(amount: i64)`, `calculate_running_balance(opening: i64, movements: &[i64]) -> Result<i64, FinancialError>`.
    - Implement idempotency hashing: `compute_payload_hash(payload: &CreateVoucherPayload) -> String`.
    - Implement sequence number formatting: `format_voucher_number(prefix: &str, year_month: &str, seq: i64) -> String`.
  - **Verification:**
    - Write unit tests in `src-tauri/src/domain/cashbook.rs` testing overflow bounds, negative bounds, and sequence formatting.

- [ ] **Task C1A.3: Native Database Worker Operations**
  - **Files:**
    - Modify: `src-tauri/src/db/worker.rs`
  - **Details:**
    - Add request variants to `DbRequest`:
      - `GetMoneyAccounts`, `CreateMoneyAccount`, `UpdateMoneyAccount`
      - `GetCashbookCategories`, `CreateCashbookCategory`
      - `GetCashbookParties`, `CreateCashbookParty`
      - `PostCashbookVoucher`, `ReverseCashbookVoucher`, `GetCashbookLedger`
    - Transactional posting workflow in worker:
      1. Validate amount and inputs against domain limits.
      2. Check `idempotency_key`: if exists, compare `payload_hash`; match $\rightarrow$ return existing; mismatch $\rightarrow$ return `Conflict`.
      3. Allocate next sequence from `cashbook_sequences` within transaction.
      4. Freeze business profile snapshot, party snapshot, and currency snapshot.
      5. Insert `cashbook_vouchers` row with status `'posted'`.
      6. Insert corresponding `cashbook_movements` row (+ for Inflow, - for Outflow).
      7. Insert `cashbook_audit_events` row.
    - Reversal workflow:
      1. Check target voucher is posted and `reversed_by_voucher_id IS NULL`.
      2. Allocate reversal sequence number.
      3. Insert reversal voucher with reversed direction and opposite-sign movement.
      4. Update original voucher setting `reversed_by_voucher_id`.
  - **Verification:**
    - Integration test in `src-tauri/tests/cashbook_worker_tests.rs` testing transaction commit, rollback on failure, idempotency replay, and reversal reconciliation.

- [ ] **Task C1A.4: Tauri Commands & App Manifest Registration**
  - **Files:**
    - Create: `src-tauri/src/commands/cashbook.rs`
    - Modify: `src-tauri/src/commands/mod.rs`
    - Modify: `src-tauri/src/lib.rs`
    - Modify: `src-tauri/build.rs`
    - Modify: `src-tauri/capabilities/default.json`
  - **Details:**
    - Register commands: `get_money_accounts`, `create_money_account`, `post_cashbook_voucher`, `reverse_cashbook_voucher`, `get_cashbook_ledger`.
    - Grant command permissions in `capabilities/default.json` to window `main`.
  - **Verification:**
    - Compile `cargo check --manifest-path src-tauri/Cargo.toml` and verify capability schema passes.

---

### Section C1B: Receipt/Payment UI, Balances & Voucher PDF

- [ ] **Task C1B.1: TypeScript Domain Contract & Repository Interface**
  - **Files:**
    - Create: `src/domain/cashbook.ts`
    - Create: `src/domain/cashbook_validation.ts`
    - Create: `src/repositories/ICashbookRepository.ts`
    - Modify: `src/domain/financial.ts`
  - **Details:**
    - Define TypeScript interfaces: `MoneyAccount`, `CashbookCategory`, `CashbookParty`, `CashbookVoucher`, `CashbookMovement`, `CashbookLedgerFilter`, `CreateVoucherInput`.
    - Add BigInt checked accumulation helper: `calculateRunningBalanceBigInt(opening: bigint, movements: bigint[]): bigint`.
    - Validate bounds in `cashbook_validation.ts`: assert `amount <= MAX_MONEY_MINOR`.
  - **Verification:**
    - Write unit tests in `src/domain/__tests__/cashbook.test.ts` verifying calculation parity with Rust calculations.

- [ ] **Task C1B.2: Tauri Native IPC Repository Implementation**
  - **Files:**
    - Create: `src/repositories/TauriCashbookRepository.ts`
  - **Details:**
    - Implement `ICashbookRepository` delegating to Tauri `invoke("post_cashbook_voucher", ...)` etc.
    - Handle structured errors (e.g. `IdempotencyKeyConflict`, `VoucherAlreadyReversed`).

- [ ] **Task C1B.3: Cashbook Ledger & Entry Modal UI**
  - **Files:**
    - Create: `src/views/CashbookView.tsx`
    - Create: `src/components/cashbook/CashbookEntryModal.tsx`
    - Create: `src/components/cashbook/AccountSelector.tsx`
    - Create: `src/components/cashbook/LedgerTable.tsx`
    - Create: `src/components/cashbook/CashSummaryCards.tsx`
    - Modify: `src/App.tsx` (add Cashbook navigation route)
  - **Details:**
    - **CashSummaryCards:** Shows Total Cash Balance, Period Inflows, Period Outflows, Net Movement (strictly labeled "Net Cash Flow", NEVER "Profit").
    - **CashbookEntryModal:** Fast toggle between "Cash In" (Receipt) and "Cash Out" (Payment); inputs for amount, account, business date, category, classification, party, reference/notes. Generates UUID `idempotency_key` on open.
    - **LedgerTable:** Lists movements with deterministic sort order, color-coded inflow/outflow, voucher number link, and action menu (Print Voucher, Reverse).
  - **Verification:**
    - Vitest component tests in `src/views/__tests__/CashbookView.test.tsx`.

- [ ] **Task C1B.4: Printable Voucher Document & PDF Export**
  - **Files:**
    - Create: `src/components/cashbook/PrintableVoucherDocument.tsx`
    - Modify: `src/styles/globals.css` (add voucher print isolation `#printable-voucher-root`)
  - **Details:**
    - Renders official receipt/payment voucher from immutable snapshot fields:
      - Header: Business name, tax ID, phone, address.
      - Voucher Meta: Voucher number, Date, Type (Receipt / Payment / Reversal).
      - Account & Party: Paid to / Received from, Payment Mode, Category, Classification.
      - Amount: Formatted currency amount and words amount.
      - Signatures: Prepared By, Authorized Signatory.
    - Supports A4 and 80mm thermal receipt layouts.
  - **Verification:**
    - Headless browser print verification verifying exact dimensions and zero UI leakage.

---

### Section C1C: Persistent Web Adapter, Backup/Restore & Acceptance Gate

- [ ] **Task C1C.1: Persistent Web IndexedDB Repository**
  - **Files:**
    - Create: `src/repositories/IndexedDbCashbookRepository.ts`
    - Modify: `src/repositories/repositoryFactory.ts`
  - **Details:**
    - Database name: `'billzen_cashbook_v1'`.
    - Object stores: `money_accounts`, `cashbook_categories`, `cashbook_parties`, `cashbook_vouchers`, `cashbook_movements`, `cashbook_sequences`, `cashbook_audit_events`.
    - Executes atomic readwrite transactions matching SQLite trigger semantics.
    - Replaces transient in-memory mocks for browser mode.
  - **Verification:**
    - Vitest fake-indexeddb suite verifying transactions, idempotency rejection, and balances.

- [ ] **Task C1C.2: Portable Backup & Safe Restore Engine**
  - **Files:**
    - Create: `src/services/backup/CashbookBackupService.ts`
    - Create: `src/views/BackupRestoreView.tsx`
  - **Details:**
    - **Export:** Serializes current profile, accounts, vouchers, movements, and audit log to JSON `billzen-cashbook-backup-v1.json` with SHA-256 checksum.
    - **Validate:** Validates version string, SHA-256 checksum, and reconciles balance equations ($\sum \text{movements} + \text{opening} == \text{balance}$) before executing any state changes.
    - **Restore Native:** SQLite Online Backup or staged write into temporary file; creates `billzen.db.recovery-{timestamp}`; atomic file swap.
    - **Restore Web:** Clear and write stores in single atomic IndexedDB transaction.
  - **Verification:**
    - Test exporting data, clearing database, restoring, and verifying 100% record identity.

- [ ] **Task C1C.3: Milestone C1 Acceptance Gate Automation**
  - **Files:**
    - Create: `scripts/verify_cashbook_c1.js`
  - **Details:**
    - Automated test script executing all 7 required C1 acceptance criteria:
      1. Oracle Invariant: Opening 0 $\rightarrow$ Receipt ₹10,000 $\rightarrow$ Payment ₹2,500 $\rightarrow$ Cash balance ₹7,500.
      2. Immutable Reprints: Reprints do not mutate records.
      3. Idempotent Retry: Retries return existing voucher; modified payload returns Conflict.
      4. Offline Restart: Process force-kill and restart preserves state.
      5. Reversal Reconciliation: Reversing payment restores balance to ₹10,000 with zero double-cancellation.
      6. Backup/Restore Roundtrip: Full data preservation.
      7. Multi-Decimal Parity: 2-decimal (INR) and 3-decimal (KWD) identical results on Native and Web.
  - **Verification:**
    - Execute `node scripts/verify_cashbook_c1.js` and generate verification report.

---

## Phase C2 Gate (Future Milestone)
- Contra Account Transfers (`TRF-YYYYMM-XXXXX`).
- Genuine multi-sheet XLSX workbooks & date-range statements.
- Receipt image attachments metadata and local storage.
- Acceptance check: Transfer ₹3,000 Cash $\rightarrow$ Bank: Cash ₹4,500, Bank ₹3,000, Combined ₹7,500 (net company cash impact = 0).
