# B1 — Offline invoice drafts implementation plan

> Execution: continue the owner-approved inline implementation workflow with an independent final review. This is the next phase plan, not a claim that draft invoicing is implemented.

**Goal:** Save, reopen and edit several offline sales drafts linked to catalog products and customers, with exact totals and no stock, money, final-number or receivable movement.

**Authority:** `docs/m4a-invoice-drafts-spec.md` and B1 of `docs/superpowers/specs/2026-10-23-transfers-and-billing.md`. The owner's2026-10-23 billing authorization schedules the previously deferred M4A draft scope after T1. Finalization, regional tax compliance, credit notes/returns and settlements remain separate B2/B3 design gates. Synchronization remains deferred.

**Architecture:** Reuse the serialized Rust worker, checked financial domain, existing invoices/invoice_items and draft_version, and durable browser workspace transactions. Add a Sales/Drafts destination and small cart/picker components following current responsive/motion/back conventions. Draft-only data is now persisted in both native and browser workspaces; no transient browser mock implementation.

## Contracts and decisions

- Use the preserved M4A DraftItemInput, CreateDraftInvoiceRequest, UpdateDraftInvoiceRequest, InvoiceDraftSummaryDto and InvoiceDraftDetailDto, matching real schema names at implementation time. Never trust totals supplied by the UI; calculate them in the transaction/domain.
- Extend create with a public `idempotency_key`. For draft creation only, use the existing invoices.idempotency_key/request_fingerprint columns with a `draft-create:` operation namespace and normalized payload hash. Same key/content returns the original draft; changed content rejects. B2 finalization must introduce its own operation identity rather than replacing draft-create evidence. Keep the key through uncertain responses.
- Updates use id + expected_version and replace lines atomically, incrementing draft_version. A stale version returns CONCURRENT_MODIFICATION_ERROR; the UI offers reload/review instead of silently overwriting. Replaying a lost update response may produce a version conflict; reload the persisted draft and preserve the unsaved local edit for comparison.
- Delete is explicitly draft-only, confirmed and expected-version checked. Replaying a creation key after its draft was deleted must not recreate the sale accidentally: retain a draft-operation tombstone in an additive migration if needed. Decide the exact tombstone schema in the first task before creating the API.
- Dates use the business timezone. Money is integer minor units, quantities scaled1000, taxes basis points, existing half-up calculations. Support both2- and3-decimal currencies. Generic draft tax rates do not certify GST/VAT or electronic-invoice compliance.
- New selections exclude archived customers/products. Existing references remain readable with a warning and must be revalidated during B2 finalization. Walk-in customer_id is null; services do not track stock.
- No final invoice or sequence number is allocated. No stock_movements, cashbook vouchers/movements, payments/allocations, customer current_balance or final receivables change. Draft preview is visibly marked DRAFT and cannot be presented as a finalized tax invoice.
- The old M4A localStorage-only autosave recommendation is superseded by durable workspace persistence. Browser unsaved edit recovery must include the source draft ID/version; recovery cannot silently overwrite a newer saved draft. Native unsaved edit recovery needs a local adapter rather than assuming a browser cache is authoritative.

## Task1 — Draft domain, native atomic lifecycle and retries

**Files:** new src/types/invoice_drafts.ts, src/domain/invoice_drafts.ts/tests, src-tauri/src/domain/invoice_drafts.rs, src-tauri/src/db/invoice_drafts.rs, src-tauri/src/commands/invoice_drafts.rs; worker/build.rs/lib.rs/capabilities; additive migration/recovery registration only if the creation/deletion retry journal requires it.

1. Map every M4A DTO field to current schema/financial domain. Record the creation/deletion tombstone representation and migration upgrade fixture before implementation. Preserve migrations1–9 and pre-migration recovery behavior.
2. Write failing native tests: create/read/list/update/delete, same-key retry/conflict, stale update and stale delete, lost response/reload, and injected second-line/total-write rollback. Snapshot stock, cash, customer balances and sequences before each lifecycle; assert zero change after it.
3. Implement the domain/worker transaction operations and scoped commands. Validate dates, quantity/discount/tax/money bounds, duplicate line numbers and catalog/customer references. Recalculate exact totals. Finalized/cancelled invoices cannot use draft mutation APIs.
4. Run relevant Rust domain/worker/migration/backup tests and frontend parity fixtures. Commit/push the native section only after the API and invariants are verifiable; do not expose an incomplete Sales screen.

## Task2 — Browser draft durability and complete backups

**Files:** new src/adapters/invoice_drafts.ts and web_invoice_drafts.ts; web_cashbook_db.ts store upgrade, web_workspace.ts, native backup validation/journal coverage, scripts/verify_invoice_drafts.js and native integration tests.

1. Write real IndexedDB failing tests with native-equivalent lifecycle, concurrency and injected storage errors. Exercise a populated DBv4 upgrade preserving catalog/customer/cashbook/transfers.
2. Add stores and atomic draft transactions. Hash outside the transaction; read settings/catalog/version inside it. Use the same DTO/results/conflict codes as native. No memory-only storage fallback.
3. Extend workspace export/restore to preserve draft invoices/items and any retry/tombstone journal. Existing browser backups currently reject all nonempty commercial tables: explicitly accept only supported draft rows and referenced items; continue rejecting finalized invoices, payments, allocations and expenses until their phases exist. Do not silently omit them.
4. Verify original checksum before compatibility normalization. If a new required journal needs a backup format bump, document and test that contract before export changes; preserve transfer1.1 and transfer-free1.0 import behavior. Validate totals, line ownership/version/customer/product references and zero-finalization state before replacement.
5. Test synthetic native→browser→native draft backup/restart, malformed totals/references rejection and atomic failure preserving prior workspace. Run workspace/customer/transfers suites and full unit/build checks, then commit/push this section.

## Task3 — Sales/Drafts editor and integration

**Files:** new InvoicingView.tsx, DraftsModal.tsx, ProductPicker.tsx, CustomerPicker.tsx, LineItemRow.tsx; App/AppNavigation/types/i18n and dedicated draft hooks as needed. Keep CashbookView unchanged except intentional links.

1. Write a browser acceptance test: select a customer, search product by name/SKU/barcode, edit scaled quantity/price/discount/tax, save, reload, hold a second draft, resume/update the first. Assert server-calculated totals and zero changes to stock, cash, transfers and customer amount due.
2. Implement a simple desktop split view and mobile cart drawer/summary. Every field has a label; numeric inputs show currency/unit; busy controls prevent duplicate submission; errors preserve the intent/cart. Walk-in and customer choices are explicit.
3. Display saved/unsaved state and conflict recovery. Versioned unsaved recovery cannot replace authoritative saved data without an explicit review. Closing/back prompts appropriately for unsaved changes, reusing focus/inert/back/motion patterns.
4. Add a clearly watermarked DRAFT preview if useful. No final-number allocation, paid/due claim or stock posting button. Link the customer/product views to draft creation only when the referenced active item is validated.
5. Check360/390/768/1280, English/Malayalam/Arabic RTL, light/dark/system, keyboard/Back and reduced motion. Test multiple drafts, zero/large totals and three-decimal currencies.
6. Run frontend/build, Cargo, workspace/customer/transfers, new draft/browser/native IPC/backup suites. Request independent whole-B1 review, fix findings with failing/passing evidence, update guides/brain/Graphify, commit/push and inspect exact remote CI. Rebuild candidates only after gates pass; public updater publication remains separate.

## B2/B3 gates after drafts

Before finalization, settle country-specific invoice profile/required fields, legal numbering/year/reset rules, availability policy and cost snapshots. Before settlements/returns, settle opening dues/credit semantics, allocation reversal and credit-note/stock-return relationships. Draft totals must not become debt or reduce stock merely because B1 exists. Supplier identity/purchase receipt/valuation and synchronization stay in their separately specified phases.
