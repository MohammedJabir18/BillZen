# Roadmap

## Completed Milestones
- **M1 & M2 Foundation**: Runnable Tauri 2 + Vite 8 + React 19 shell, SQLite WAL database worker, OS single-instance lock, strict platform CSP, and financial arithmetic engine.
- **Regional Foundation & Verification**: Support for 2-decimal and 3-decimal currencies (India & GCC), currency change protections, automated headless A4 PDF generation.
- **M3 & M3.1 Catalog Integrity**: Products, customers, case-insensitive categories, leading-zero barcode indexing, stock movements, and dual-checksum migration safety.
- **Android Beta & Hardening (v1004)**: Distribution APK with dead-code eliminated WebView debugging, test-build CDP opt-in, comprehensive 14-stage runtime verification suite on Android 14 API 34.

---

## Active Milestone: Offline Company Cashbook (Phased Delivery)

The primary business priority is an offline company cashbook for recording money received and paid, issuing numbered vouchers, maintaining account balances, and ensuring safe portable backup.

### Phase C0: Architecture & Implementation Specification (COMPLETED)
- Authored `docs/cashbook-architecture-spec.md` and `docs/superpowers/plans/2026-10-19-cashbook-implementation-plan.md`.
- Formalized money-flow classification, canonical ledger, zero double-cancellation reversals, immutable snapshots, and exact integer arithmetic contracts.

### Phase C1: Core Cashbook Vertical Slice (COMPLETED)
- **C1A**: Schema migration `v7_cashbook_foundation.sql`, Rust domain entities, checked arithmetic, sequence generator, native Tauri commands, and transaction integrity tests.
- **C1B**: React UI (dashboard summary, entry modal, ledger table, filters) and printable voucher PDF engine (`RCP-`, `PAY-`).
- **C1C**: Persistent Web IndexedDB adapter, portable whole-workspace JSON backup and safe restore engine (RFC 8785 JCS + SHA-256), hardened native desktop harness with provenance and cold restart, and cross-platform verification suite.

### Phase C2: Transfers, Statements & Workbooks (NEXT MILESTONE)
- Atomic 2-legged account transfers (`TRF-YYYYMM-XXXXX`).
- Multi-sheet XLSX workbooks and period date-range PDF statements.
- Local receipt attachment metadata and storage.

### Phase C3: Tools, Budgets & Security
- Currency denomination physical cash counter.
- Category monthly budgets and spending charts.
- Local offline reminders and session app lock.

### Phase C4: Commercial Invoicing Integration
- Resume deferred Milestone 4A/4B (`docs/m4a-invoice-drafts-spec.md`).
- Integrate invoice settlement directly into cashbook vouchers without duplicate accounting.
- Optional Android-only after-call entry shortcuts.

---

## Deferred Milestones
- **Milestone 4A (Invoice Drafts)**: Specification preserved in `docs/m4a-invoice-drafts-spec.md`; deferred until cashbook ledger foundation (C1-C3) is complete.
- **Milestone 4B (Invoice Finalization & Stock Decrements)**: Deferred to Phase C4.

---

No calendar delivery estimate is established; milestone acceptance depends on test evidence and platform access.
