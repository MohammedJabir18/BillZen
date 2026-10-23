# Product stock management

Products → **Manage Stock** is available on desktop rows and compact product cards.

## Daily workflow

1. **Add**: enter the quantity received, business date and reason/reference. Review current → resulting stock, then confirm. Example:50+20=70.
2. **Reduce**: enter a positive quantity for damage, loss or a physical-count correction; the system subtracts it. Example:70−2=68. A negative resulting stock is blocked.
3. **History**: see opening balance and immutable movements with signed quantity, business date, reason and the stock immediately after that movement.
4. **Correct movement**: select an original adjustment, review its opposite quantity, enter a reason/date and confirm. Original evidence remains. Each adjustment permits one correction; correcting a correction is blocked. A correction that would make stock negative is also blocked.

Quantity supports up to3decimal places (internally integers×1000). No rounding of excess precision. Maximum supported balance is1,000,000units. Archived/untracked products have read-only history; restore a tracked archived product before further adjustment. Initial opening stock still belongs in Add Product.

A rejected adjustment refreshes current stock and allows edits. An unknown storage/IPC result keeps its exact retry identity and locks its details until retry confirms the outcome; retry instead of creating another entry. This prevents an acknowledged-late save from changing stock twice. The form is not a durable cross-process pending-operations queue: resolve pending operations before restarting the app.

Stock adjustment records quantity only. It does not create a Cashbook payment, supplier bill, sale, tax liability, or invoice. Record an actual payment separately. Automatic invoice-based stock decrement remains later billing work.

## Technical implementation

- `src/adapters/stock.ts` dispatches to native worker IPC or a serialized IndexedDB catalog transaction.
- `src-tauri/src/db/stock.rs` appends a movement and updates current quantity in one SQLite transaction. Commands: `post_stock_adjustment(input)`, `get_stock_history(productId)`; scoped default capabilities are generated.
- Reuses existing `stock_movements`: reference_type=`adjustment`; original reference_id=null; correction reference_id=original movement ID. Notes store JSON `{business_date,reason}`; plain legacy opening notes remain supported. No schema migration or backup-format bump is required.
- UUID retry identity compares normalized product, signed quantity, date, reason and correction reference. Same intent returns original movement; changed intent rejects. Current product status, ledger reconciliation and stock bounds are revalidated at posting time.
- History sorts posting timestamp descending with ID as tie-breaker. A business date is descriptive, not a retroactive historical stock recomputation; shown resulting balances are posting-time snapshots.
- Backup1.1 already includes products and stock_movements. Browser and native round-trip checks retain IDs, quantities, correction references and retry behavior. Native/backend errors distinguish known unwritten rejections from unknown transport outcomes.

## Verification

- `npm run test:stock`: browser engine concurrent same/different retries, fractional/minimum/maximum stock, insufficient/invalid input, duplicate corrections, untracked/archived guards, no-op retry writes, injected rollback, backup/restore and reload.
- `npm run test:stock-ui`: preview/add/reduce/history/correction, stale-balance rejection recovery, unknown write retry, short viewports, EN/ML/AR, RTL and keyboard focus/Escape.
- `cargo test --manifest-path src-tauri/Cargo.toml`: native atomic rollback, bounds/intent/correction checks, real backup round-trip and worker rejection-vs-transport classification.
- `npm run test:native-cashbook`: built Linux binary IPC posting/retry/insufficient/correction/history and cold restart; synthetic data only.

Physical Android, Windows and macOS execution is a separate platform check; shared source does not mean an existing installer/APK has been rebuilt.
