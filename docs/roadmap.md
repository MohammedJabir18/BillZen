# Roadmap

Current product state: 24 October 2026. Acceptance evidence, not a calendar promise, determines completion. See [release 0.1.6](distribution-v0.1.6.md) and [verification](verification-status.md).

## Available

| Area | Delivered scope |
| --- | --- |
| Foundations | Tauri/React/Rust, SQLite worker/WAL, migrations, checked financial arithmetic and scoped native commands |
| Company Cashbook | Receipts/payments, account opening balances, categories/parties, numbered vouchers, warnings, reversals and reports |
| Customer integration | Explicit customer-party links, immutable cash history, receipt shortcuts and Reports context |
| T1 transfers | Atomic account pairs, idempotent retry, negative-balance confirmation, paired reversal and transfer-aware reports/documents |
| Product stock | Opening stock, Add/Reduce, reasons/previews, immutable movement history and opposite correction entries |
| Durability | Persistent browser IndexedDB, complete native/browser backup 1.1, legacy transfer-free 1.0 import and validated restore/recovery |
| Interface | Today-first/simple/analytical dashboards, responsive navigation/Reports, settings theme/language, skippable guide, EN/ML/AR and reduced-motion-aware transitions |
| Distribution | Desktop 0.1.6 Windows x64/Linux x64/Apple Silicon, Android ARM64 0.1.5, signed desktop/Android update paths; no new Android APK in 0.1.6 |

Hosted packaging/signature checks do not substitute for physical Windows/macOS device runtime testing. Linux exact-package and actual private-baseline signed upgrade acceptance are recorded separately.

## Next commercial slice: B1 invoice drafts

[Implementation plan](superpowers/plans/2026-10-23-invoice-drafts.md) · [Preserved draft specification](m4a-invoice-drafts-spec.md).

Drafts must save/reopen/edit offline with conflict protection and native/browser backup parity. A draft must not change stock, cash, debt or final invoice numbering. Do not infer draft/finalize completion from existing invoice schema or printable fixtures.

## Planned after the relevant acceptance gates

- Atomic invoice finalization, numbering, item/tax/customer snapshots and sale-linked stock movements.
- Invoice receivables, payment allocation/settlement and supplier purchase bills, without duplicate cash accounting.
- Jurisdiction-specific tax/e-invoicing integrations only with explicit requirements and verification.

## Separate, unshipped work

XLSX workbooks, attachment storage, budgets, cash denomination tools, offline reminders/session lock, scheduled local backups, encrypted storage and thermal printer acceptance remain separate work. Account transfers are already delivered; they are not blocked on these tools.

Device synchronization and multi-user collaboration are deferred by owner choice. Each device initially keeps independent local data. iOS and Intel Mac installer distribution are not offered. No cloud dependency is required for existing local business operations.

Historical C0/C1/C2 and M0–M4 plans remain in `docs/` and session memory as design/history. This page summarizes current delivered boundaries rather than treating every historical phase title as an active commitment.
