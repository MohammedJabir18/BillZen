# Account transfers — engine and backup status

As of 2026-10-23, T1 Tasks1–3 are implemented in source. The Transfer money screen, paired reversal controls, transfer-aware charts/statements/CSV and A4 transfer document are still Task4 work. Installed desktop and Android packages have not been rebuilt for T1.

## Transaction rules

A transfer owns an outgoing voucher/movement and an incoming voucher/movement. The complete pair, number sequence, header and audit commit atomically. Moving ₹2,000 from cash ₹5,000 to bank ₹1,000 leaves ₹3,000 in each account and total company money ₹6,000. It adds zero to receipt, payment and operating cash-flow totals.

The same request key and content returns the existing transfer. Changed content with the same key rejects. A negative source balance requires explicit confirmation unless that account allows overdrafts. Confirmation rechecks current balances. Reversal creates a complete opposite pair and preserves original snapshots; individual legs cannot be reversed. Repeating the paired reversal returns the same reversal.

Native commands and frontend adapters expose post, list and reverse. Browser operations require durable IndexedDB and saved business settings; they do not fall back to volatile transfer storage. No synchronization or billing finalization is included.

## Portable backups

- New exports use format **1.1** with `cashbook_transfers`, even when empty. Use a current reader; older1.0-only readers reject this format.
- Transfer-free **1.0** backups remain importable. The original checksum is verified before a missing transfer array is normalized. A1.0 envelope containing transfer vouchers or headers rejects.
- Restore rejects incomplete or reassigned pairs, duplicate ownership, inconsistent movements, stale number sequences, changed intent/hash/snapshots, noncanonical retry keys and incomplete reversal links.
- Failed validation or browser storage writes preserve the previous workspace. Native restore validates a staging database before replacement.
- The old partial browser cashbook helpers reject workspaces containing transfers. Use complete workspace export/restore. Browser restore continues to reject unsupported nonempty commercial invoice/payment/expense tables.

## Repeatable verification

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run test:workspace
npm run test:customer-cashbook
npm run test:transfers
npm run test:transfer-interop
```

The browser scripts launch isolated Chrome contexts and temporary local Vite servers. The interoperability script creates synthetic native data in a temporary directory, imports it into browser storage, exports it and verifies import back into native SQLite. It preserves IDs, snapshots, reversal metadata, movements and audits. It never opens the installed application's business database. The explicitly ignored Cargo interop test is invoked with its synthetic fixture by this harness.
