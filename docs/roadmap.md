# Roadmap

## M3 catalog integrity — implemented corrections

Stock/price/quantity bounds, tracking transition checks, the category unique index and the portable native probe were added in `a116ac0`. Independent review reproduced a legacy-upgrade failure, so M3 closure remains conditional.

## CI correction checkpoint

Diagnose the CI-only long-text PDF extraction assertion using retained artifacts; keep missing-content detection intact. See [verification status](verification-status.md). Commit/push this as a separate verified section.

## Next product correction: M3.1 migration safety

Reconcile valid V4 category case collisions before enforcing uniqueness. Preserve product references and category metadata with a deterministic, transactional policy. Respect checksum history for any existing V5 installation. Test colliding and collision-free upgrades, clean install, rollback, repeat startup and foreign-key integrity. See [the review](reviews/2026-10-18-m3-review.md) and [Antigravity handoff](antigravity-next-task.md).

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
