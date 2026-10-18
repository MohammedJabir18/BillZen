# Architecture

Status: foundation and catalog implementation, reviewed 2026-10-18.

## Boundaries

React components call `src/adapters/tauri.ts`. In Tauri, commands registered in `src-tauri/src/lib.rs` invoke the Rust worker. In a regular browser, the adapter substitutes in-memory data. Some views use TanStack Query; catalog views currently use React state and call the adapter directly. Zustand is installed but not yet used by application code. This is a modular application with ports/adapters boundaries, not a fully extracted multi-package clean architecture.

The Rust worker owns the SQLite connection on one background thread. Requests use a bounded Tokio channel and response channels. A synchronous initialization handshake reports database or migration errors before normal UI startup. An OS advisory lock prevents a second cooperating application process from opening the same application directory. External SQLite clients can still contend for database access.

## Storage

`get_app_data_dir()` resolves `dirs::data_dir()/billzen`, falling back to `./billzen` when OS resolution fails. The database and lock share that directory. No implemented named Windows mutex or `/tmp/billzen.lock` path should be inferred from earlier platform design notes.

The connection enables foreign keys, WAL, synchronous FULL and a busy timeout. These improve transactional behavior and durability but remain subject to OS/filesystem/hardware guarantees. Migration SQL is embedded and tracked with checksums. See [data model](data-model.md).

## Financial representation

- Money: integer currency minor units, with explicit currency code and exponent.
- Quantity: integer units scaled by 1,000.
- Tax: integer basis points.
- Rounding: explicit half-up operations; BigInt intermediates in TypeScript and checked integer arithmetic in Rust.

JSON numbers must remain within JavaScript's safe integer range. Domain-specific bounds can be tighter. Catalog validation and invoice calculation bounds currently differ; see the known issues before implementing billing.

## Security and documents

Tauri capabilities scope command access by window. CSP restricts frontend resources and connections. Static configuration tests do not replace a live unauthorized-window IPC test. Local SQLite is not encrypted and there is no application authentication workflow.

`PrintableInvoiceDocument.tsx` renders a document model with A4 print CSS. The PDF scenarios use synthetic fixtures. A native one-click save/export adapter and thermal formats are future work.

## Future adapters

Web needs a durable local storage adapter. Mobile needs validated app-private paths, lifecycle behavior, responsive layouts and OS print/share adapters. Cloud synchronization, an outbox and statutory integrations are not implemented.
