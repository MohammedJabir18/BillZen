# Antigravity handoff · Milestone C2: Transfers, Statements & Workbooks

Copy the following task into Antigravity. The GitHub delivery rule is also persisted in the repository's `AGENTS.md`.

---

Read AGENTS.md, brain/architecture.md, brain/sessions.md, docs/cashbook-architecture-spec.md, docs/superpowers/plans/2026-10-19-cashbook-implementation-plan.md, and docs/roadmap.md before changing code.

Use the installed Superpowers systematic-debugging, test-driven-development and verification-before-completion skills. Use Karpathy Guidelines to keep changes surgical and focused, Harness Engineering for reproducible verification, Archify for updated documentation, and frontend-design/impeccable for accessible and responsive financial UI.

## Objective

Deliver Milestone C2: Transfers, Statements & Workbooks, extending the verified Milestone C1 offline Cashbook foundation.

## Concrete Implementation Deliverables

1. **Atomic Two-Legged Account Transfers**:
   - Transfer voucher numbering sequence: `TRF-YYYYMM-XXXXX`.
   - Single atomic transaction creating source outflow movement and destination inflow movement.
   - Dual-account balance invariant validation (source account negative balance check).
   - Atomic reversal of transfer vouchers voiding both movement legs simultaneously.

2. **Multi-Sheet XLSX Workbooks & Statement Export**:
   - Tabular export generating `.xlsx` workbooks: Summary Sheet, Account Ledgers, and Audit Trail.
   - Period date-range PDF statements with formal opening balance, period movements, running balance column, and closing reconciliation.

3. **Receipt Attachment Storage & Metadata**:
   - Local offline attachment management (image/PDF vouchers).
   - Content hashing and path metadata stored in SQLite without external cloud dependencies.

4. **Automated Cross-Platform Verification**:
   - Rust unit & integration tests covering transfer atomicity and multi-account invariants.
   - Vitest contract tests for transfer DTOs and calculations.
   - Automated browser and native desktop Playwright tests verifying transfer UI and export downloads.


