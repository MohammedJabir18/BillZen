# B1 implementation evidence

## Task1 — native draft foundation (2026-10-24)

Implemented serialized native create/get/list/update/delete and pure draft totals commands; no Sales UI yet. Existing invoices and invoice_items own draft values; array position assigns unique line_number. Draft metadata and exact checked totals use the M4A fields. DTO item fields are flattened snake_case over IPC. Detail/summary add currency_code/currency_exponent and customer/product archive warnings. Empty and ad-hoc drafts are supported; active catalog selections are required, while an archived reference already on that draft remains editable/readable.

Migration10 adds draft_create_operations without changing migrations1–9. Namespaced creation key, normalized original request JSON, SHA256, invoice ID and creation time survive updates; deletion adds deleted_at/deleted_version and retains original intent. Equal creation retries return the latest saved draft, changed content rejects, and a deleted key cannot recreate a sale. Omitted creation date is pinned on retry; omitted update date preserves its saved date. Delete replay requires the exact deleted version. Unsupported legacy draft rows without creation evidence fail closed on deletion.

Draft invoices retain NULL number/sequence/finalized_at and business/customer commercial snapshots, zero paid amount and computed schema-required balance_due. That schema value is not posted customer debt. No catalog stock, stock movement, cashbook, payment/allocation, customer balance or final sequence is written. Update replaces lines and totals atomically and increments expected_version. Known rejection codes distinguish validation/conflict/deleted state; transport/SQLite failures remain uncertain for exact retry.

Until Task2 delivers portable journal support, native workspace export rejects a nonempty creation journal (including deleted-only tombstones) instead of silently dropping it. Existing journal-free backup1.1 behavior remains available. No release, installation, signing or deployment performed.

Evidence: native integration tests cover lifecycle/retry/conflict/reopen, concurrent create/update, stale update/delete, second-line/total/journal aborts, invalid inputs/cancelled mutation, active/archived references, populated v9 upgrade/recovery/checksums and three-decimal/empty drafts. Zero-effect snapshots include existing nonzero stock/customer balance/final sequence fixtures. Frontend normalization/arithmetic fixtures match hand-calculated native values. Full Cargo suite and frontend97/build passed; existing Vite chunk/dynamic-import warnings remain.

Next: Task2 durable IndexedDB upgrade, full native/browser backup format compatibility and interop; Task3 accessible multilingual Sales/Drafts editor and whole-B1 independent review.
