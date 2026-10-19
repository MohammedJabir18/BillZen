# Antigravity handoff · Milestone C1B: Cashbook UI & Printable Vouchers

Copy the following task into Antigravity. The GitHub delivery rule is also persisted in the repository's `AGENTS.md`.

---

Read AGENTS.md, brain/architecture.md, brain/sessions.md, docs/cashbook-architecture-spec.md, docs/superpowers/plans/2026-10-19-cashbook-implementation-plan.md, and docs/roadmap.md before changing code.

Use the installed Superpowers systematic-debugging, test-driven-development and verification-before-completion skills. Use Karpathy Guidelines to keep changes surgical and focused, Harness Engineering for reproducible verification, Archify for updated documentation, and frontend-design/impeccable for accessible and responsive financial UI.

## Objective

Deliver Milestone C1B: a fully usable offline company Cashbook with Receipt/Payment entry, accurate running balances, ledger filtering/browsing, explicit reversal workflow, and printable vouchers (A4 and 80mm thermal), building upon the hardened C1A native foundation (V8 migration).

## Concrete Implementation Deliverables

1. **Focused Backend & Query Corrections**:
   - Decouple display filters (text search, classification) from financial statement balances (`opening_balance_minor`, `period_inflows_minor`, `period_outflows_minor`, `net_operating_cash_flow_minor`, `closing_balance_minor`). Provide optional `matching_inflows_minor` and `matching_outflows_minor`.
   - Derive reversal business date and numbering month from the company configured timezone (Asia/Kolkata, GCC) from a single captured UTC instant.
   - Comprehensive regression tests for mid-transaction rollback, reversal rollback atomicity, and persistence/idempotency across worker restarts.

2. **TypeScript Contracts & Native Tauri Adapter**:
   - Type definitions in `src/types/cashbook.ts` matching Rust domain structs and actual command signatures.
   - Idempotency key management, negative balance confirmation retry workflow, and authoritative backend submission.

3. **Usable Cashbook UI & Navigation**:
   - Main Cashbook navigation view with responsive layout (mobile cards, desktop table).
   - Summary cards: Total Cash, Active Cash, Period Inflows/Outflows, Period Opening/Closing Balances.
   - Receipt & Payment voucher entry modal with account selection, category dropdown, party auto-complete, and two-step negative balance confirmation dialog.
   - Ledger table with date-range filters, account filter, search, voucher details drawer, and reversal action.

4. **Printable Vouchers (A4 & Thermal 80mm)**:
   - Dedicated printable component for `RCP-` and `PAY-` vouchers rendering frozen snapshots.
   - Clean print media styling isolating voucher output from application navigation.

5. **Automated Verification & Tests**:
   - Rust unit and integration tests (71+ tests).
   - Frontend component/contract tests covering entry, filters, and calculations.
   - Playwright/Puppeteer automated browser flows.

