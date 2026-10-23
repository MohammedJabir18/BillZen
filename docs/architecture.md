# Architecture

Current overview: 24 October 2026. See the [source-backed interactive diagrams](diagrams/README.md) and [v0.1.6 acceptance](distribution-v0.1.6.md). Historical design documents describe intent; current adapters and runtime code define implemented behavior.

## Runtime boundaries

The React workspace routes business operations through typed adapters: `tauri.ts`, `cashbook.ts`, `customer_cashbook.ts`, `stock.ts` and `transfers.ts`. Installed apps invoke scoped Tauri commands; supported browser workflows use IndexedDB. The browser is no longer a disposable in-memory demonstration. A headless no-IndexedDB fallback exists for tests and is not equivalent to durable browser storage.

Native commands use a Rust database worker that owns one SQLite connection on a background thread. A bounded Tokio channel serializes requests; multi-record posting/reversal/restore operations use transactions. Initialization reports migration/database failure before normal UI startup. An OS advisory lock prevents two cooperating desktop instances from using the same workspace; external SQLite clients can still contend.

Some views use TanStack Query and others call adapters with React state. Zustand is installed but unused. This is a modular ports/adapters application, not a fully extracted multi-package architecture.

## Storage and recovery

Desktop storage resolves through the OS data directory's `billzen` folder; `BILLZEN_DATA_DIR` supports isolated native test workspaces. Android uses its app-private runtime path. Browser IndexedDB is scoped to its origin/profile/device; deleting site data deletes those records. Neither adapter synchronizes devices.

SQLite uses foreign keys, WAL, synchronous FULL and a busy timeout. Embedded, checksummed migrations and recovery snapshots protect supported upgrades. These measures remain subject to OS/filesystem/hardware limits.

Complete portable workspace backup 1.1 covers implemented catalogs, settings, opening/adjusted stock, cashbook/accounts/parties/audits and transfers. Restore validates the graph/checksum before replacement; supported legacy transfer-free 1.0 data is normalized. Backup durability does not imply encryption: SQLite and exported JSON are unencrypted today. See [backup/transfer contracts](transfer-engine-status.md).

## Business invariants

- Money uses integer minor units and explicit currency/exponent; quantities use integers scaled by 1,000. Checked Rust arithmetic and TypeScript safe-number/BigInt boundaries avoid unchecked floating-point financial operations.
- Receipts/payments create numbered immutable snapshots, account movements and audit evidence atomically. Corrections use reversals; negative source balances require explicit confirmation when applicable.
- Account transfers post both legs atomically and reverse together. They affect account balances while staying outside business receipt/payment totals.
- Customer linkage supplies cash history and report navigation, not an invoice-receivables engine.
- Product Add/Reduce movements preserve before/after history and opposite corrections; they do not create cash payments. Invoice-based stock decrement is future work.

## Interface and documents

Dashboard, Cashbook, Reports, Products, Customers and Settings share responsive navigation and reusable selectors/dialogs. GSAP motion respects reduced-motion changes; dialogs manage focus and background inertness. Language/theme belong in Settings; the first-run guide is skippable. English, Malayalam and Arabic/RTL resources support India/GCC use, without implying statutory tax/e-invoicing certification.

React documents and print CSS render vouchers, transfer documents, reports and invoice-model fixtures. Print/Save-as-PDF support depends on the platform. A rendered invoice fixture does not establish a complete persisted draft/finalize workflow. Physical/thermal printer acceptance remains separate.

## Signed updates and security

The desktop Rust updater service owns discovery/download/install state. Only constrained main-window commands are exposed; generic updater plugin IPC is not granted. Configuration pins the public key, immutable BillZen release URL boundary and authenticated version. Installation checkpoints WAL, creates a snapshot, pauses database work, installs verified bytes and restarts/hands over; errors resume access. Linux requires the writable AppImage edition. Android uses its independent signed manifest/installer path. See [desktop updates](desktop-updates.md).

Tauri capabilities/CSP constrain the webview. This does not imply encrypted storage, a user-authentication/team system or protection from an already compromised OS. No hosted business database, synchronization outbox or statutory integration is implemented.
