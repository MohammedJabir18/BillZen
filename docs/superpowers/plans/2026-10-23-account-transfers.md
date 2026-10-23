# Atomic Account Transfers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline implementation task-by-task; use superpowers:subagent-driven-development only if the owner selects delegated execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move money between local same-currency accounts with atomic paired posting/reversal, accurate reports, printable transfer evidence and portable validated backups.

**Architecture:** Keep the existing immutable voucher/movement model: one new transfer header owns two vouchers, each owning one account movement. Dedicated native worker and browser transaction routes enforce pair integrity; ordinary posting/reversal cannot create or split a transfer. Add explicit backup1.1 support and1.0 import normalization before exposing the UI.

**Tech Stack:** Existing React/TypeScript/TanStack Query, Tauri/Rust/rusqlite, SQLite migrations, IndexedDB, Vitest/Cargo/Playwright. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-23-transfers-and-billing.md`, T1 section approved by owner on2026-10-23. This plan covers T1 only; billing has separate subsequent plans. Status: ready for owner review/execution-method selection; implementation not started.

## Global Constraints

- Preserve offline desktop/Android/web operation, current UI style, single business/base currency, current device-local workspaces and integer financial arithmetic.
- Only the dedicated transfer command may create these records. Ordinary voucher routes continue rejecting transfer.
- Never permit ordinary reverse on either transfer leg.
- Any failure rolls back both legs, sequence and audit.
- Printing/exporting never creates another transaction.
- Fees are a separate expense voucher; currency exchange is outside T1.
- Device synchronization remains explicitly deferred by the owner.
- Native SQLite and browser IndexedDB paths must satisfy the same behavioral acceptance tests.
- Existing main delivery workflow is owner-authorized; inspect author/committer identities, stage intended files, never include real databases/signing secrets, commit/push verified sections and inspect actual CI. Do not publish installers/update feeds under this implementation plan.

## Review Focus

1. Crash/abort after the first leg: neither account, sequence nor audit may retain a partial operation.
2. Duplicate submission/stale balance confirmation: public retry identity must return one operation; changed payloads fail; current balances revalidated.
3. Ordinary reverse or corrupt restored pair: no half reversal, foreign leg ownership or second reversal accepted.
4. Filtered reports/charts: transfers change balances while remaining outside receipt/payment/operating totals.
5. Legacy backups/older clients:1.0 data survives upgrade;1.1 is rejected by older readers and malformed pairs never replace a workspace.

## File ownership and interfaces

Create focused native `src-tauri/src/domain/transfers.rs` for DTOs, validated intent/hash and header types; `src-tauri/src/db/transfers.rs` for transactional posting/reversal/query helpers called by existing worker. Expose modules in current domain/db mod files. Keep worker queue ownership; do not open a second database connection from a command.

Create `src/types/transfers.ts`, `src/adapters/transfers.ts`, `src/adapters/web_transfers.ts`, `src/domain/transfers.ts`, `src/components/TransferDialog.tsx`, `src/components/PrintableTransferDocument.tsx`, and `src/i18n/transfers.ts`. Existing cashbook types, print document union, native command/build/capability registration and query views adapt to these units.

Test files: `src/domain/transfers.test.ts`, `src-tauri/tests/transfer_worker_tests.rs`, `scripts/verify_transfers.js`; extend existing workspace/native tests with pair corruption cases. Generated permissions/schemas are tracked only where the repository already tracks them.

Contract (TypeScript; equivalent Rust snake_case DTOs):

```ts
interface CreateTransferInput {
  idempotency_key: string;
  from_account_id: string;
  to_account_id: string;
  amount_minor: number;
  business_date: string;
  reference_note?: string | null;
  notes?: string | null;
  confirmed_negative_balance?: boolean;
}
interface ReverseTransferInput {
  transfer_id: string;
  confirmed_negative_balance?: boolean;
}
type TransferResult =
  | { status: 'posted'; transfer: CashbookTransfer }
  | { status: 'requires_confirmation'; account_id: string;
      current_balance_minor: number; projected_balance_minor: number;
      amount_minor: number; message: string };
```

`CashbookTransfer` has exactly the spec's header fields, with nullable reversal/reference metadata; booleans on wire and SQLite0/1 internally. `post_cashbook_transfer({input})`, `reverse_cashbook_transfer({input})`, `get_cashbook_transfers({filter})` return TransferResult/TransferResult/header array. Filter has optional account_id, start_date, end_date and includes both directions for a selected account. Deterministic ordering is business_date, posted_at, id. Existing account ledger retains transfer leg rows.

Retry hash includes normalized source/destination/amount/date/reference/notes and excludes confirmation. Reject caller-supplied public keys in reserved internal prefix `__billzen_transfer__:` across ordinary and transfer endpoints. Leg keys derive from reserved prefix + operation UUID + direction; UUID is generated once inside a successful transaction. Same public key with changed intent fails; reversal uses the original header's reversal linkage as its retry identity.

## Task 1 — Pair schema, domain and migration

**Files:** create `src-tauri/src/db/migrations/v9_cashbook_transfers.sql` if9 remains next; modify db/mod.rs, domain/mod.rs, db/mod.rs module exports; create native/TS domain files and tests above.

- [ ] Write failing domain/migration tests: amount200000 minor accepted, zero/negative/overflow rejected, equal accounts rejected, normalized hash stable, changed destination changes hash, confirmation does not. Validate ISO calendar date and bounded IDs/notes with existing conventions.
- [ ] Run targeted `cargo test --manifest-path src-tauri/Cargo.toml --test transfer_worker_tests` and `npx vitest run src/domain/transfers.test.ts`; observe missing schema/interfaces before implementation.
- [ ] Implement header table exactly per spec. Add unique leg references/number/key, distinct-account and positive-money checks; indexed account/date/reversal links. Reject header deletion or financial-field mutation after posting. Permit only a validated unreversed→reversed metadata transition; reject reversal-of-reversal. Preserve existing v7/v8 migrations/checksums.
- [ ] Register migration checksum/upgrade and pre-migration recovery snapshot through existing mechanisms. Add a fixture containing v8 customer receipts/opening stock; upgrade and verify every original row and amount unchanged. Failure must retain recoverable prior data.
- [ ] Add browser DBv4 transfer-header store/indexes while preserving DBv3 data. Share header shape and intent normalization with TS adapter; do not enable UI yet.
- [ ] Run migration/domain tests green, inspect schema diff and commit the focused foundation. Re-read current migration numbering before applying.

## Task 2 — Native atomic posting and paired reversal

**Files:** native transfer helpers, worker request/handle/dispatch, commands/cashbook.rs, lib.rs, build.rs, default capability, generated command permissions; native tests.

- [ ] Add failing worker tests: Cash500000/Bank100000, transfer200000 →300000/300000, two vouchers/two movements/one header; company balance600000; no party/category/stock change.
- [ ] Add negative-source cancellation and confirmed retry, archived/missing/same accounts, currency/exponent mismatch, overflow of either resulting balance, duplicate/concurrent public key and changed-content key conflict tests. Use current policy for allow-negative; validate under IMMEDIATE transaction.
- [ ] Implement dedicated worker operations with existing connection, checked arithmetic and shared timestamp. Reserve TRF-YYYYMM-NNNNN; allocate movement sequences consistently with existing ledger. Store header/legs/snapshots/audit in one transaction; do not invoke two independently committing ordinary posting operations.
- [ ] Prove rollback by injecting a failure after first movement/header/second voucher as separate cases, checking full account, sequence and audit state against baseline.
- [ ] Add failing reversal cases: paired inverse restores balances; ordinary reverse rejects either leg even before considering negative confirmation; duplicate reverse returns existing reversal; reversal-of-reversal fails; archived accounts follow existing reversal policy explicitly (reject archived account and request restore before correction); outgoing reversal negative balance warns/confirms.
- [ ] Implement TRF-REV paired reversal with original per-account snapshots. Map each inverse leg to the corresponding original voucher by account, not merely source/destination label; update both original flags/header in the same transaction and audit the confirmation if required.
- [ ] Extend native ledger/summary queries: full balance uses all movements; receipt/payment/operating metrics exclude classification transfer. Transfer-only matching rows must be labeled separately; matching receipt/payment totals exclude transfer too. Add transfer debit/credit totals in summary if UI needs them; do not silently reuse receipt fields.
- [ ] Run native tests plus entire Cargo suite. Inspect capability changes and commit/push verified native section; inspect actual CI.

## Task 3 — Browser transaction and backup1.1 compatibility

**Files:** web_transfers.ts, transfers adapter/types, web_cashbook_db.ts, web_workspace.ts, domain/backup_crypto.ts and tests, types/backup.ts, native db/backup.rs and tests.

- [ ] Reproduce native acceptance fixtures against real IndexedDB, not in-memory fallback: simultaneous post, injected second-leg abort, ordinary reversal rejection, paired reverse and negative warning/confirmation. Observe red before writing routes.
- [ ] Implement browser transfer operations inside one readwrite transaction over transfer headers, accounts, settings, vouchers, movements, sequences and audit stores. Read settings/accounts/confirmation balance within that transaction. Keep IDs/numbering/intent/reversal semantics equal to native.
- [ ] Export format1.1 with required cashbook_transfers array in native/browser payloads. New readers accept valid1.0 only with zero transfer headers and no transfer-classification vouchers; verify checksum on original payload before normalizing the missing array. Never mutate payload before checksum verification.
- [ ] Extend native/web restore validation: exact owned pair, sign/account/date/currency agreement, TRF/TRF-REV header and leg numbering, sequence floors, snapshot agreement, complete reversal links, unique ownership and no unowned transfer vouchers. Native restore inserts legs/header/reversal updates in an order compatible with FK/immutability triggers while validating the complete proposed workspace first. Preserve audit records and identifiers.
- [ ] Test native↔web synthetic1.1 roundtrip, legacy1.0 import/restart, old1.0 verifier rejection of1.1,1.0 transfer injection, missing/extra/reassigned leg, stale sequences, wrong snapshot and half-reversal. Every invalid/injected-storage failure preserves prior workspace. Keep current safe rejection of unsupported nonempty commercial tables in browser.
- [ ] Update browser ledger/summary calculations and frontend fixture contracts to agree with native. Run foundation suite, unit tests, backup/Rust tests and build; commit/push this compatibility section after independent review.

## Task 4 — Transfer UI, report/print and acceptance

**Files:** CashbookView.tsx, DashboardView.tsx, ReportsView.tsx, new dialogs/print/i18n, types/index.ts print union, App.tsx print route, CSV/export helpers where needed; verify_transfers.js and native runtime script.

- [ ] Add browser regression first: Transfer money button → source/destination/amount/date → preview → post → account balances3000/3000, company6000, receipts/payments unchanged. UI must show readable account names and no technical UUIDs.
- [ ] Implement accessible responsive dialog with existing CashbookDialog/motion/back behavior. Disable duplicate submission, preserve public intent key through uncertain response/negative confirmation, explain changed-balance revalidation and show explicit success/error. Invalidate account, ledger, summary, reports and transfers queries only after commit.
- [ ] Render transfer legs with direction/shared number, no ordinary receipt/payment reversal button. Provide a paired reverse action and original/reversal evidence; replaying view/print/export creates no transaction.
- [ ] Update chart aggregation to exclude transfer legs rather than relying only on corrected summary fields. Test mixed sale receipts/expenses/transfers on Today/Month/Year, account filters and both all-account legs.
- [ ] Implement printable A4 transfer document with immutable names, source/destination, amount/currency, date/number/status. Reuse active print isolation; label transfer rows properly in account statements/CSV. Report opening/closing stays full balance; selected receipt/payment subtotals exclude transfers.
- [ ] Test narrow360/390, tablet768, desktop1280; English/Malayalam/Arabic RTL, light/dark/system, keyboard/focus/Android Back and reduced motion. Export/print preview totals and rows must agree. Verify cold restart and backup restore in real browser/native isolated workspaces.
- [ ] Run `npm test`, build, `npm run test:workspace`, customer, Cashbook, Reports, motion and new transfer suites; full Cargo suite; native IPC transfer post/reverse/rollback checks. Add new verifier to CI after browser installation.
- [ ] Request independent whole-section review covering the five Review Focus risks. Correct failures with red→green evidence. Inspect diff, identity, intended staging, commit/push and remote CI state.

## Delivery boundary and next phase

- [ ] Update usage guide, verification status, brain sessions/architecture and Graphify with actual outcomes/limitations. Mark shipped features separately from proposed invoice/purchase work.
- [ ] Rebuild desktop/Android candidates only after source gates pass; preserve old signing identity and real user data. Public updater release/version increment/publication remains a separately requested delivery action. Do not imply a source push updates installed apps.
- [ ] Present B1 draft-invoice execution plan next, grounded in existing M4A specification and the approved broad billing scope. Resolve region/numbering/return/payment bridge decisions before their respective finalization/settlement phases. Sync remains deferred.
