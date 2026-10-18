# Roadmap

## Next: M3 integrity closure

Fix the stock tracking transition/reconciliation case, align catalog and billing numeric limits, enforce safe scaled quantities, decide category name case behavior, and make probe/browser automation portable. Add focused regression tests demonstrating each defect before applying the fix. Re-run Rust, frontend, browser and persistence checks. Keep feature scope limited to these corrections.

## Then: M4A draft invoice vertical slice

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
