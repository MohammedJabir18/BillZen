# Business Integration Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make browser catalogs durable and connect existing customers to actual cashbook receipts/history without introducing false receivables or duplicate postings.

**Architecture:** Keep native SQLite behind the existing worker. Extend the existing browser IndexedDB workspace to hold catalog data alongside cashbook records so links and restore are transactional. Preserve Customers and Cashbook Parties with explicit ID linkage; do not replace them with a new contact model.

**Tech Stack:** Existing React/TypeScript/TanStack Query, Tauri/Rust/rusqlite, IndexedDB, Vitest, Cargo and Playwright. No new runtime dependency required by this plan.

**Spec:** `docs/business-integration-blueprint.md`, proposed 2026-10-23. This plan is not implementation approval. P2–P6 require separate plans.

## Global Constraints

- Keep one business workspace, one base currency, one operator and independent local device data for the first integration release.
- Use explicit stable IDs, never automatic name matching.
- Cashbook remains the authoritative money ledger.
- Preserve finalized document snapshots and current reversal protections.
- Reject cross-currency aggregation/transfer in this first design.
- Do not display net cash history as customer amount due.
- Do not modify historical migration files, real business records, signing keys, release feeds or app styling.

## Review Focus

1. Old backups contain catalog/stock tables that the browser previously could not durably preserve: reject unsupported imports before any write or preserve them completely.
2. Same-name contacts and several legacy parties linked to one customer: explicit selection, stable IDs and deduplicated history.
3. Interrupted save/restore, storage quota failure and repeated clicks: no partial workspace, duplicate receipt or false success.
4. Archived/renamed contacts and reversed vouchers: immutable historical evidence remains visible.
5. Reports across date/account filters: customer cash subtotal is distinct from account balance and commercial debt.

## File ownership map

Existing paths to modify only where needed:

- `src/adapters/web_cashbook_db.ts`: database upgrade, object stores and shared transactional workspace operations.
- `src/adapters/tauri.ts`: replace mock catalog calls and route backup operations to durable workspace functions.
- `src/adapters/cashbook.ts`, `src/types/cashbook.ts`: typed party-link/history contracts.
- `src-tauri/src/domain/cashbook.rs`, `src-tauri/src/commands/cashbook.rs`, `src-tauri/src/db/worker.rs`, `src-tauri/src/lib.rs`: native commands and worker requests.
- `src/components/CustomerCatalogView.tsx`, `src/components/CashbookView.tsx`, `src/components/ReportsView.tsx`, `src/App.tsx`: linked navigation and history/report context.
- `src/types/backup.ts`, `src/domain/backup_crypto.ts`, `src-tauri/src/db/backup.rs`: shared backup compatibility if formats change.
- Relevant existing `src/i18n` files: translations, including Arabic RTL behavior.

Proposed new files:

- `src/adapters/web_catalog.ts`: durable catalog CRUD using the shared IndexedDB connection; no separate database.
- `src/adapters/web_catalog.test.ts`: catalog contract checks.
- `src/components/CustomerCashHistory.tsx`: read-only linked money timeline with no invented receivable.
- `src-tauri/tests/customer_cashbook_tests.rs`: native relationship/statement tests.
- `scripts/verify_customer_cashbook.js`: isolated end-to-end browser checks.

Choose a new migration number only after checking the then-current last migration. Native schema changes may be unnecessary for the initial bridge; add an index/migration only where query/constraint needs justify it. Do not assume a unique customer-party index can safely be applied to existing data.

## Task 1 — Durable browser catalog and restore contract (P0)

**Interfaces:** Preserve existing `getProducts/createProduct/updateProduct/archiveProduct/restoreProduct`, Customer and Category adapter signatures. Implement their browser branches through `web_catalog.ts`. Catalog and cashbook operations share the existing database, with a version upgrade that retains all old stores.

- [ ] Write a failing browser regression: create customer/product/category and opening stock, reload, retrieve identical IDs/values; archive/restore survives another reload. Do not use the in-memory test fallback to prove durability.
- [ ] Add a backup fixture with linked customer, party, voucher and opening stock. Assert export → fresh workspace import → reload preserves every link and amount. Include a prior-format fixture and duplicate/missing reference rejection.
- [ ] Define workspace import coverage before implementation: preserve every supported table including stock movements; reject nonempty unsupported commercial tables before mutation. Do not accept and silently discard invoice/payment data.
- [ ] Extend IndexedDB stores and implement catalog operations with native-equivalent validation, normalized category uniqueness and stock-opening arithmetic. Add native/web contract cases for all three.
- [ ] Make restore validation precede replacement, then commit all supported workspace tables atomically. Include business settings in the authoritative durable workspace so localStorage writes cannot split a restore. Local preference caches may be derived after commit.
- [ ] Remove browser mock arrays from production adapter paths. Preserve any live in-session catalog records during transition if applicable; do not invent records previously lost by refresh.
- [ ] Add quota/transaction-abort and two-tab upgrade tests: existing data remains intact, blocked upgrade explains that another tab must close, and save failure is visible. Replace hardcoded backup app version with the project's actual version source.
- [ ] Run `npm test`, `npm run build`, `npm run test:catalog`, and the new persistent-browser regression with its isolated dev server/workspace. Observe red before implementation and green after; record actual commands/results.
- [ ] Inspect diff, verify Git identities, commit intended files, push and inspect source CI. Gate: no web integration readiness claim before real reload/restore tests pass.

## Task 2 — Explicit customer-to-party bridge (P1A)

**New proposed interfaces** (TypeScript adapter; Rust IPC uses corresponding snake_case names):

```ts
ensureCustomerCashbookParty(input: {
  customer_id: string;
  existing_party_id?: string;
}): Promise<CashbookParty>
```

Semantics: validate active customer; explicit existing party may be linked only if currently unlinked or already linked to that customer. Never steal another customer's party. Without an explicit party, return the sole existing active link; create one if no historical link exists; if several links exist or only archived links exist, return a typed selection-required result/error, not a silent replacement. Creation/linking is serialized/transactional and idempotent by relationship, not contact name.

- [ ] Add failing native and web tests for repeated ensure, two simultaneous ensure calls, unknown customer, archived customer, same-name customers, party linked elsewhere, archived links and multiple legacy links.
- [ ] Implement worker request/command registration and browser equivalent. Define typed error codes in `src/types/cashbook.ts` and Rust domain. Keep `customer_id` as the bridge; write audit evidence for explicit link changes without altering voucher snapshots.
- [ ] Add owner-reviewed existing-party selection UI. No bulk automatic name/phone merge. Display conflicting links and leave data untouched until resolved.
- [ ] Ensure catalog edits update the current linked contact projection according to a documented field ownership rule (Customer is authoritative for linked name/contact fields); historical vouchers retain snapshots. Do not expose competing editors for the same fields.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --test customer_cashbook_tests`, the new web tests and build. Assert failed linking changes no voucher, balance or stock row.
- [ ] Inspect, commit, push and inspect CI as a coherent relationship section.

## Task 3 — Customer cash history and receipt shortcut (P1B)

**New proposed interfaces:**

```ts
type CustomerCashHistoryFilter = {
  customer_id: string;
  start_date?: string;
  end_date?: string;
  account_id?: string;
};
type CustomerCashHistory = {
  entries: CashbookLedgerEntry[];
  received_minor: number;
  paid_minor: number;
  net_movement_minor: number;
};
getCustomerCashHistory(filter: CustomerCashHistoryFilter): Promise<CustomerCashHistory>
```

History consumes every linked party, including archived parties. Aggregate movements once by movement ID, retaining original and reversal rows with clear labels. Signed movement amounts determine totals. Existing entry running-balance fields remain account-specific; the customer screen must not present them as customer debt or a combined multi-account running balance. Define server-side pagination before shipping if the query exceeds current bounded ledger behavior; totals must cover the full filtered set, not only the displayed page.

- [ ] Add failing tests: receipt 12,000 minor + payment 2,000 minor yields received 12,000, paid 2,000, net 10,000; reversing the receipt yields net −2,000 with both original/reversal evidence. Date/account filters and same-name contacts must not leak rows.
- [ ] Implement read queries in worker/browser adapter with explicit customer IDs and deterministic business-date/sequence ordering. Until invoice integration, do not update `customers.current_balance_minor` from these cash totals.
- [ ] Add `CustomerCashHistory.tsx`, a customer-detail action and Receive money shortcut. Pass a typed customer/party intent through `App.tsx` to the existing Cashbook form; confirm current contact and selected account before posting.
- [ ] Reuse `postCashbookVoucher` and its idempotency/negative-balance handling. No second customer-specific receipt ledger. Disable repeat submission while pending and preserve recovery after uncertain responses.
- [ ] After success, refresh Cashbook, customer history, Dashboard and Reports. CustomerCatalog currently uses local state; explicitly refresh its relevant view or migrate only the necessary queries rather than assuming global Query invalidation updates it automatically.
- [ ] Add party/customer report filter and reuse CSV/print paths. Label totals as cash received/paid/net movement. Hide or clearly mark the legacy customer balance as unavailable until genuine receivables are implemented.
- [ ] Verify create → linked receipt → reload → history → report → export → reversal; screenshot mobile/desktop, Arabic RTL, light/dark and keyboard focus. Verify one receipt changes account total exactly once and never changes product stock.
- [ ] Run new browser script, `npm run test:cashbook`, `npm run test:reports-ui`, `npm test`, build and targeted native tests. Run native customer flow in an isolated workspace; do not infer native success from browser tests.
- [ ] Inspect diff, commit, push and inspect CI. Update verification status with evidence and any physical-platform limitations.

## Completion and handoff

- [ ] Demonstrate the owner's workflow with synthetic data: existing customer → Receive money → numbered receipt → customer cash history → matching daily report.
- [ ] Update `brain/sessions.md`, architecture only for shipped changes, and roadmap/verification evidence; refresh Graphify with honest fallback reporting.
- [ ] Rebuild installers only as a separate delivery section after source tests pass. Source push is not an installed app update or published release.
- [ ] Prepare P2 transfer design next. Keep invoice/purchase/valuation/sync implementation outside this foundation scope.

## Execution record — 2026-10-23

Tasks1–3 implemented as the supported-workspace/customer-cashbook foundation. See docs/customer-cashbook-guide.md and docs/verification-status.md for actual checks and scope. Safe browser rejection of nonempty commercial tables follows Task1's stated alternative; no data is silently discarded. Complete invoice/purchase workflows remain outside this plan. Desktop delivery and credential-gated APK packaging are tracked separately from source completion. Original step checkboxes are retained as the authored checklist; this execution record and verification report describe observed results.
