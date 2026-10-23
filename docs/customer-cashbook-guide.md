# Customer receipts and cash history

Implemented 2026-10-23 as the first business-integration foundation. Invoice receivables, supplier bills and account transfers remain later phases.

## Use the workflow

1. Open **Customers** and create or select a contact.
2. Select **Cash history**. The totals show money received, money paid and net money movement for that customer.
3. Select **Receive money**. BillZen reuses the existing linked cashbook party, or creates a link. If several historical links exist, choose the intended active party explicitly. An existing unlinked party may also be linked; a party owned by another customer cannot be reassigned here.
4. Confirm the customer, destination account, amount and business date in the Cashbook form. Post once; the existing retry and negative-balance confirmation protections apply.
5. Reopen customer history to inspect the numbered receipt. Use its date/account filters or **View in Reports** to inspect/export matching cashbook records. Reversals remain visible with their opposite money effect.

A ₹120 receipt and ₹20 payment give net movement ₹100. Reversing the ₹120 receipt leaves net movement −₹20 and retains all three records. This does not calculate an invoice balance or change product stock.

Renaming the customer refreshes linked current contact details. Previously posted voucher snapshots retain their original name/contact information. Archived historical links remain part of the customer's money history.

## Browser durability and backup

Products, categories, customers, opening stock movements, business settings and cashbook data live in the same IndexedDB workspace. Existing catalog-only stock balances are migrated to opening stock ledger records during the version3 upgrade. A blocked upgrade asks the user to close other BillZen tabs.

Settings backup export reads one consistent snapshot. Restore verifies the checksum, supported table coverage, references, stock quantities, money bounds, voucher movements, reversal relations and sequence counters before replacing supported records in one transaction. Storage errors abort the replacement; the previous workspace remains intact. Restored table names/counts describe actual writes.

Native backups containing nonempty commercial invoice/payment/expense tables are explicitly rejected by browser restore until those workflows are implemented there. Restore those backups in the native app. This avoids silently dropping unsupported records. A checksum is integrity checking, not encryption.

Base currency/exponent cannot be changed after products or financial activity exist. Durable workspace settings take precedence over a stale browser preference cache. Devices still have independent local workspaces; this feature adds no synchronization.

## Verification commands

- `npm test` — frontend unit/contract checks.
- `npm run test:workspace` — real Chromium persistence, version upgrade, blocked second-tab upgrade, linked backup/reversal validation, storage-failure rollback, fresh restore and customer-link isolation tests. Starts its own isolated Vite server on4194; uses system Chrome and ephemeral browser contexts.
- `npm run test:customer-cashbook` — customer receipt/history/report/CSV/reversal workflow, responsive/RTL/theme/keyboard evidence on4193.
- `npm run test:cashbook`, `npm run test:reports-ui`, `npm run test:motion` — existing acceptance suites.
- `cargo test --manifest-path src-tauri/Cargo.toml` — native domain, worker, backup and customer integration tests.
- `npm run test:native-cashbook` — real Linux Tauri IPC, isolated database, linked customer receipt/report/reversal and cold restart. Requires the rebuilt release binary and an available desktop/WebKit inspector environment.

Browser and native data used by these tests are synthetic. Physical printers, Windows/macOS and Android device behavior need their respective platform checks; Linux/Chrome results do not certify those platforms.
