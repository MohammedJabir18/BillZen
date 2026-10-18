# Technical design & decision register

Reviewed 18 October 2026 against the M3 catalog implementation. Runtime behavior is authoritative in source; future designs are labeled explicitly.

## Current runtime

1. The React interface calls `src/adapters/tauri.ts`.
2. The adapter detects Tauri and invokes a registered native command. In an ordinary browser, it uses disposable in-memory data.
3. Commands delegate to `DbWorkerHandle`, which sends a typed request to the background worker.
4. The worker validates input and owns the SQLite connection. Catalog creation persists the product and tracked opening movement in one transaction.
5. The response returns to the view; errors are presented without claiming the record saved.

At startup, the application resolves its data directory, acquires an advisory lock, initializes the worker and applies checksum-tracked migrations before normal UI startup. The lock only coordinates cooperating instances; an external process can still contend for SQLite access.

## Architecture decisions

| ID | Decision | Reason / consequence |
| --- | --- | --- |
| ADR-01 | Tauri + Rust + React/Vite | Native system boundary with a reusable interface; platform APIs still require native verification |
| ADR-02 | Rust-owned bundled SQLite | No runtime database service; one worker owns database access |
| ADR-03 | Serialized requests + startup handshake | Explicit initialization failure and ordered connection use; expensive queries can still affect queue latency |
| ADR-04 | Integer money and scaled quantities | Explicit rounding and overflow checks instead of floating-point financial writes |
| ADR-05 | Versioned, checksum-tracked migrations | Detect drift; upgrades must be exercised with previously valid data |
| ADR-06 | Browser mock behind adapter | Fast UI development; mock evidence must remain distinct from native evidence |
| ADR-07 | HTML/React document model + A4 CSS | Reuse presentation and inspect PDF fixtures; native print parity remains separate |
| ADR-08 | Local fonts | Offline glyph rendering; preserve font license notices |
| ADR-09 | Section-sized commits and pushes | Reviewable checkpoints with real local/remote verification evidence |

These are a compact current-state decision register. Future changes with meaningful tradeoffs should add a dated ADR describing context, options, decision and consequences.

## Storage and schema

See [data model](data-model.md) for tables and migrations. SQLite uses foreign keys, WAL, synchronous FULL and a busy timeout. These settings depend on filesystem/OS/hardware guarantees and do not make copying an open main database file alone a safe backup.

`dirs::data_dir()/billzen` contains `billzen.db` and `billzen.lock`. Current code falls back to `./billzen` if the OS data-directory lookup fails. The database is unencrypted. Changing data paths or adding a backup mechanism requires its own recovery and upgrade plan.

### Migration correction required

V4 permits category names that differ only by ASCII case. V5 adds a unique NOCASE index without reconciling those valid rows. The index creation can fail and prevent startup. The correction must define a deterministic canonical category, repoint product references, preserve metadata/audit information, and commit atomically before enforcing uniqueness. It must also consider whether any V5 installation already exists before changing a checksum-tracked migration. SQLite's built-in NOCASE is not full Unicode case folding.

See the [reproduced review finding](reviews/2026-10-18-m3-review.md). This task documents the issue; it does not change production migration behavior.

## M4A proposed boundary

A draft invoice command should accept a typed draft DTO with an explicit currency context and item identities/quantities. Rust validates and calculates totals, and persists header/items as one transaction. Reopening must reproduce the stored draft after a process restart. Define draft repricing behavior, customer/item snapshots and revision-conflict handling before implementation.

Draft saving must not consume a final invoice number or decrement inventory. Finalization is a separate M4B transaction with retry/idempotency semantics, immutable snapshots and atomic stock movements. Do not wire a print-fixture object directly to a final commercial write.

## Security and verification

Keep capability registration, window permission policy and command validation aligned. Configuration assertions do not replace live unauthorized-window invoke tests. Review native filesystem/print APIs separately for each platform. Optional cloud sync is outside the current runtime.

See [testing](testing.md) for what each suite establishes. Tests need known-bad upgrade fixtures, exact-boundary inputs, failed transactions and restart behavior. Current browser tests use mocks, while the native probe exercises the actual worker/database but bypasses the webview and IPC boundary.

## Unresolved design work

- Migration reconciliation policy and immutable recovery evidence.
- Draft versioning, snapshot/repricing rules and finalization idempotency.
- Inventory shortage/negative-stock policy and correction transactions.
- Safe online backup, validated restore and optional encrypted exports.
- Native print/save adapters, thermal formats and physical device coverage.
- Windows/macOS packaging, mobile lifecycle/storage and durable web adapter.
- Statutory integrations and synchronization conflicts.
