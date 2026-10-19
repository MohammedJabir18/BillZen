# Antigravity handoff · Milestone C1A: Cashbook Schema & Native Posting Service

Copy the following task into Antigravity. The GitHub delivery rule is also persisted in the repository's `AGENTS.md`.

---

Read AGENTS.md, brain/architecture.md, brain/sessions.md, docs/cashbook-architecture-spec.md, docs/superpowers/plans/2026-10-19-cashbook-implementation-plan.md, and docs/roadmap.md before changing code.

Use the installed Superpowers systematic-debugging, test-driven-development and verification-before-completion skills. Use Karpathy Guidelines to keep the change focused, Harness Engineering for reliable verification/handoff, and Archify where relevant.

## Objective

Implement Milestone C1A of the Offline Company Cashbook: SQLite migration `v7_cashbook_foundation.sql`, Rust domain entities with checked integer arithmetic, atomic voucher sequence generator, native Tauri IPC commands, and transaction integrity tests.

## Concrete Implementation Deliverables

1. **Database Migration `v7_cashbook_foundation.sql`**:
   - Create tables: `money_accounts`, `cashbook_categories`, `cashbook_parties`, `cashbook_vouchers`, `cashbook_movements`, `cashbook_sequences`, `cashbook_audit_events`.
   - Triggers for posted voucher immutability: block `UPDATE` and `DELETE` on posted vouchers.
   - Trigger blocking opening balance changes once movements exist.
   - Upgrade currency change protection trigger to include cashbook vouchers and non-zero accounts.
   - Register migration in `src-tauri/src/db/migrations/mod.rs` with exact SHA-256 checksum tracking.

2. **Rust Domain & Arithmetic Engine**:
   - Create `src-tauri/src/domain/cashbook.rs` with exact 64-bit integer minor unit arithmetic, checked addition/subtraction, and `MAX_MONEY_MINOR = 10^11` validation.
   - SHA-256 payload hash calculation for idempotency verification.
   - Sequence number formatter: `{PREFIX}-{YYYYMM}-{SEQUENCE:05d}`.

3. **Database Worker & Transactional Posting Service**:
   - Implement `PostCashbookVoucher` and `ReverseCashbookVoucher` in `src-tauri/src/db/worker.rs`.
   - Idempotency guard: exact payload hash match returns existing voucher; mismatch with identical key returns `Conflict`.
   - Reversal guard: equal and opposite movements; original and reversal movements both persist in ledger summing to zero; zero double-cancellation; duplicate reversals rejected.

4. **Tauri Commands & Permissions**:
   - Register commands in `src-tauri/src/commands/cashbook.rs` and configure `capabilities/default.json`.

5. **Test Suite**:
   - Unit tests for financial bounds, half-up rounding, and sequence formatting.
   - Integration tests in `src-tauri/tests/cashbook_worker_tests.rs` verifying transaction commit, rollback on failure, idempotency collision rejection, and reversal balance restoration.

## Acceptance Criteria
- 53 existing Rust tests and 14 frontend tests pass without regression.
- New C1A integration test proves:
  - Account with opening 0 + Receipt ₹10,000 + Payment ₹2,500 = Cash balance ₹7,500.
  - Reversal of ₹2,500 payment restores balance to ₹10,000.
  - Reused idempotency key with different payload fails with `Conflict`.
  - Modification of posted voucher is rejected by database trigger.
