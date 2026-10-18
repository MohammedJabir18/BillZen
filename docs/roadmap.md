# Roadmap

## M3 & M3.1 catalog integrity — completed corrections

Stock/price/quantity bounds, tracking transition checks, category case-insensitive uniqueness, portable native probe, and CI PDF line-wrapping normalization were added. In M3.1, legacy V4 databases containing case-colliding categories (e.g. `Groceries` and `groceries`) are transactionally reconciled with canonical preservation, product repointing, and dual-checksum backward compatibility. 40 Rust tests, 14 Vitest tests, Playwright catalog E2E, and Playwright A4 PDF matrix verify this closure.

## Next milestone: M4A draft invoice vertical slice

Implement one complete offline workflow: choose a customer, search/scan a product, set quantity, calculate validated totals, save a draft, close/reopen and restore it. Keep calculations authoritative in Rust and add native command integration tests. Do not decrement stock for an editable draft. Snapshot semantics and optimistic conflict handling must be explicit.

## M4B finalization and inventory

Finalize with a unique invoice number and immutable snapshots. Persist totals and inventory movements atomically. Protect against repeated clicks/retries, insufficient stock policy violations and partial failure. Verify rollback, restart persistence and ledger reconciliation.

## Later milestones

- Partial payments, allocations, receipts and derived receivables.
- Expenses and reconciled analytics.
- SQLite online backup, validated restore, recovery and optional encrypted exports.
- A4 export/print adapters followed by 80 mm/58 mm layouts and physical device verification.
- Windows/macOS native build and release CI, then Android/iOS offline parity and durable web storage.
- Country-specific tax adapters and statutory submission flows where required.
- Optional cloud synchronization with explicit conflict handling and no mandatory account for local operation.

No calendar delivery estimate is established; milestone acceptance depends on test evidence and platform access.
