# Verification status

Review date: 2026-10-18. This file distinguishes local observations from product completion claims.

## Fresh verification

Fresh local runs during this documentation/upload session:

| Check | Result |
| --- | --- |
| `npm test` | 14 tests passed across 2 files |
| `npm run build` | TypeScript and Vite build passed |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 38 tests passed (including 5 regression tests & V5 migration upgrade) |
| Catalog Playwright | All 6 scripted steps passed |
| A4 PDF matrix | All 4 scenarios passed; page counts 1 / 3 / 1 / 1 |
| Catalog cross-process probe (`npm run test:native-probe`) | Separate write and read/verify processes passed with an isolated, cross-platform temporary database (`scripts/run_native_probe.js`) |
| Documentation review | Relative links and source claims reviewed; minor corrections applied |

No GitHub Actions success is implied by local results. Physical printers and other native OS targets were not tested. Graphify code-only refresh passed; full document extraction requires an unconfigured LLM API key and SQL AST extraction requires an optional missing parser.

## Resolved M3 Integrity Defects

1. **Stock reconciliation:** Untracked products reject opening stock at creation (`opening_stock_scaled > 0`). Transitioning from untracked to tracked product in `update_product` reconciles `current_stock_scaled` against `SUM(quantity_delta_scaled)` in `stock_movements`, rejecting any phantom stock balances.
2. **Catalog versus invoice price bounds:** Selling price and cost price are strictly bounded to `0 <= price <= MAX_MONEY_MINOR` (100,000,000,00) in both Rust worker and TypeScript UI validation.
3. **Quantity bounds:** Opening stock and minimum alert thresholds are strictly bounded to `0 <= quantity <= MAX_QUANTITY_SCALED` (1,000,000,000 scaled = 1,000,000.000 units) in both Rust worker and TypeScript UI validation.
4. **Category uniqueness:** Added migration `v5_category_nocase.sql` creating unique index `idx_categories_name_nocase ON categories(name COLLATE NOCASE)`. Case-insensitive duplicate category names ("Groceries" vs "groceries" vs "  GROCERIES  ") are rejected deterministically.
5. **Probe portability:** Replaced hardcoded POSIX `/tmp/` and `rm -f` commands in `package.json` with a cross-platform Node runner `scripts/run_native_probe.js` using `os.tmpdir()` and clean temporary directory lifecycle.

## High-priority upgrade blocker discovered during independent review

**M3 is not fully closed.** V4 permits categories such as `Groceries` and `groceries`; V5 attempts a unique NOCASE index without reconciling them. This reproduces a UNIQUE constraint failure and prevents database startup. The green upgrade test seeds only one category and misses the collision case. See [reproduction and correction requirements](reviews/2026-10-18-m3-review.md).

The checks listed above were rerun successfully during this README/license session on 18 October 2026, including 38 Rust tests. Their success does not override this untested legacy-data failure. Migration behavior was not changed in this documentation task.

## Remaining Known Issues Before M4 Invoicing

1. **Native UI coverage:** The cross-process probe verifies database worker and process lifecycle but does not replace webview/IPC end-to-end tests. Browser mock tests cannot establish native UI persistence.
2. **Product scope:** Invoice draft/finalize transactions, stock decrements, payment allocation workflows, expense UI, backup/restore, encryption and synchronization remain incomplete for Milestone 4+.

Additional review targets: unsaved form navigation, localized input parsing, long catalog performance, native unauthorized-window command denial, responsive layouts and platform-specific printing.

## Publication scope

Documentation screenshots are synthetic browser demonstrations captured by the existing catalog script. They do not certify native runtime connectivity. No production database or customer documents should be uploaded.


## Remote CI observation — 18 October 2026

Run [39144580607](https://github.com/MohammedJabir18/BillZen/actions/runs/39144580607) at licensing checkpoint `c814678` completed with a successful Rust job and a failed frontend/PDF job. Frontend unit/build/catalog steps passed; `Run Playwright Invoice Matrix Verification` failed because `scenario_long_text` did not contain the exact extracted string `South Asian Trans-Regional Infrastructure`. The four scenarios passed locally.

Root cause is not established by that message alone. Inspect the retained CI PDF/text/rendered artifact, browser versions, font readiness and whitespace/wrapping differences before changing an assertion or layout. Do not weaken text/overflow checks merely to obtain a green badge. Artifact: [browser verification](https://github.com/MohammedJabir18/BillZen/actions/runs/39144580607/artifacts/12143105642).
