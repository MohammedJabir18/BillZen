# Database model

The executable schema is the ordered SQL under [`src-tauri/src/db/migrations`](../src-tauri/src/db/migrations). Run it through the migration runner rather than copying selected CREATE statements into a live database.

| Table | Responsibility |
| --- | --- |
| `schema_migrations` | Applied versions and checksum metadata |
| `business_settings` | Business identity, regional and currency settings |
| `products` | Catalog identity, prices, quantity and stock settings |
| `categories` | Product grouping |
| `customers` | Customer identity, contact and address fields |
| `invoices` | Commercial document header and business snapshots |
| `invoice_items` | Line item snapshots and financial amounts |
| `stock_movements` | Inventory movement records |
| `payments` | Payment records |
| `payment_allocations` | Allocation between payments and invoices |
| `invoice_sequences` | Invoice numbering counters |
| `expenses` | Expense records |

## Migrations

1. `v1_init.sql`: foundational business, catalog and financial schema, indexes and triggers.
2. `v2_regional_foundation.sql`: regional settings and currency protections.
3. `v3_protect_currency_exponent.sql`: additional finalized-invoice currency protection.
4. `v4_catalog.sql`: categories, category relationship, minimum stock thresholds and customer address additions.
5. `v5_category_nocase.sql`: unique NOCASE category-name index. Existing V4 case-colliding rows currently cause this upgrade to fail; see the review.

Never edit an already-applied migration in a release; add a numbered migration and register it in `src-tauri/src/db/mod.rs::run_migrations`. Test both new database creation and upgrades from an existing database. A checksum mismatch must be investigated rather than bypassed.

Products reference categories; invoice lines reference invoice headers and product data; payments connect to invoices through allocations. Finalized document triggers constrain header and line edits. These database protections are a foundation: a complete finalization transaction, invoice numbering workflow and stock decrement workflow still need implementation.

Opening stock and its movement are transactional for tracked products. Untracked creation now rejects nonzero opening stock; enabling tracking rejects a balance that diverges from ledger history. V5 enforces ASCII-oriented NOCASE name uniqueness, but does not yet reconcile existing V4 case variants before creating the index. That upgrade gap can prevent startup. See [M3 review](reviews/2026-10-18-m3-review.md).
