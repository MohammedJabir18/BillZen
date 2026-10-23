# BillZen transfers and billing specification

Date: 2026-10-23. Baseline:69c6e92. Status: proposed design for owner review; not implemented.

## Intent and scope

The owner approved adding account transfers, sales-based stock changes, invoice receivables and supplier bills. On clarification, synchronization is explicitly deferred until transfers/billing are complete. Preserve offline desktop/Android/web operation, current UI style, single business/base currency, current device-local workspaces and integer financial arithmetic.

Deliver independently verifiable phases: T1 transfers, B1 invoice drafts, B2 finalized retail sales, B3 receipts/receivables, P1 supplier bills/goods receipts/payables. Do not add a cloud account or synchronization infrastructure in these phases. This specification does not publish a release or authorize sending reminders to customers.

## Current constraints from code

- v7/v8 enforce immutable posted vouchers and one account/amount/direction relationship with their movements. Cashbook movements are not a general double-entry journal.
- Ordinary voucher posting rejects transfer classification. Ordinary reversal reverses one voucher; that must never reverse only half a transfer.
- Native worker serializes database requests; browser workspace DBv3 uses IndexedDB transactions.
- Existing invoice/items/payments/allocations/stock tables are foundations, not an available commercial workflow. Read docs/m4a-invoice-drafts-spec.md before implementing invoice drafts.
- Workspace restore currently validates ordinary receipt/payment numbers, sequences and one movement per voucher; new transfer/commercial structures require explicit validators and compatible backup versioning.
- Customer cash history is money movement, not debt; retain this distinction when invoice balances arrive.

## T1: internal account transfers

### User experience

Cashbook gains **Transfer money** beside Receive/Pay. Form: From account, To account, amount, business date, optional reference/notes. Exclude archived accounts, reject identical accounts and mixed currencies/exponents. Preview both projected balances and show that company money is unchanged. Fees are a separate expense voucher; currency exchange is outside T1.

Example: Cash5,000 and Bank1,000; transfer2,000 yields Cash3,000 and Bank3,000, company total6,000. No receipt income, operating expense, customer cash history or product quantity changes.

If the source would become negative, return a confirmation-required result before writing. On confirmation re-read both balances and validate the exact payload atomically; insufficient/changed balance must not use a stale preview. Respect existing allow-negative account policy and audit explicit overrides.

### Storage decision

Use a new immutable **cashbook_transfers** header linked to two ordinary-shaped cashbook vouchers. This preserves v8 voucher/movement integrity rather than weakening the existing one-account rules.

Proposed header fields: id, transfer_number, idempotency_key, payload_hash, from_account_id, to_account_id, amount_minor, business_date, out_voucher_id, in_voucher_id, reference_note, notes, currency_code_snap, currency_exponent_snap, created_at, posted_at; reversal_for_transfer_id, is_reversal, is_reversed, reversed_by_transfer_id, reversed_at. Require unique number/key/leg IDs, positive bounded amount, distinct accounts, valid FKs and immutable posted fields. Add account/date and reverse-link indexes. Choose actual new migration number after checking the latest migration at execution time; never edit v7/v8 in place.

Number header TRF-YYYYMM-NNNNN via existing sequence storage; leg voucher numbers derive as header + -OUT and -IN. Both vouchers have classification transfer, null customer/category, immutable account/business/currency snapshots, distinct internal retry keys derived from the public transfer intent, and one matching signed movement each. Only the dedicated transfer command may create these records. Ordinary voucher routes continue rejecting transfer.

Transaction order: validate intent/hash and duplicates → read active accounts/base currency and balances → confirmation gate → allocate number → insert both vouchers/movements and header → audit → commit. Repeating same key/content returns the same transfer; changed content under the key is an error. Any failure rolls back both legs, sequence and audit. SQLite and IndexedDB must have equivalent behavior.

### Reversal

Expose **Reverse transfer** as one operation. Never permit ordinary reverse on either transfer leg. Reversal creates one linked TRF-REV header and two opposite linked reversal vouchers using original snapshots and existing reversal protections. Mark both original vouchers and header reversed in the same transaction. Reject second reversal, reversal-of-reversal, and changed/partial/unknown links. If the original destination no longer holds enough funds, apply confirmation to the reversal's outgoing account. Keep original and reversal as visible evidence.

### Queries, reports and printing

Account ledger/running balance includes its leg. All-account ledger may show both legs clearly labeled Transfer out/in with shared transfer number. Receipt/payment/operating summaries and charts exclude transfer legs and their reversals; source-account transfer effects remain visible in opening/closing/current balances. Provide a separate transfers total if useful, never count both sides as sales/expenses. Party history excludes transfers because no customer is assigned.

Report matching totals must state whether transfer rows are included; avoid a receipt total that includes transfers while its headline excludes them. Transfer preview/PDF shows source, destination, date, number, amount and reversal status. Printing/exporting never creates another transaction. Preserve period/account filters and existing theme/RTL/mobile/focus/reduced-motion behavior.

### Backups and migration

Add transfer headers to native/web export and restore. Export a new explicit format version supported by updated native/web readers; old clients must reject it before replacing data. New readers continue importing valid1.0 backups with empty transfer headers. A1.0 payload containing transfer records must be rejected, not silently treated as an ordinary backup.

Validate exactly two legs per header, opposite signed amounts, common date/currency, accounts matching header, unique ownership, matching numbers/sequences, no dangling/unowned transfer vouchers, full reversal symmetry and unchanged immutable snapshots. Reject half-transfer, cross-linked legs, duplicate numbers/keys and nonzero company transfer sum before writes. Restore all supported tables in one transaction. Back up before native migration and preserve DBv3 browser data during upgrade.

### T1 acceptance gates

1. Cash5,000 → Bank1,000; transfer2,000 produces3,000/3,000 and company6,000.
2. Receipt/payment income/expense metrics, customer history and stock remain unchanged.
3. Same-account, missing/archived account, zero/negative/overflow amount and currency mismatch write nothing.
4. Negative source cancels without writes; explicit confirmed retry posts once and audits it.
5. Concurrent/repeated submissions and key conflicts do not duplicate either leg or consume partial numbers.
6. Inject failure after first leg; verify no header/leg/movement/sequence change survives.
7. Account-filtered/all-account views and CSV/PDF agree on balances and transfer treatment.
8. Paired reversal restores original balances; second/half reversal rejected. Reversal negative-balance warning applies to the outgoing side.
9. Valid backup → fresh restore → restart retains all relationships; malformed pairs/reversals fail without altering previous workspace.
10. Run real browser and isolated native IPC journeys, narrow mobile/desktop/RTL/theme/keyboard checks. Physical Android behavior remains a separate gate.

## Billing phases after T1

### B1 — invoice drafts

Implement the preserved M4A spec with an Invoices/Sales destination. Select existing customer or anonymous walk-in, catalog products/services, quantities, prices, discounts, taxes under existing checked integer calculations. Save/reopen several drafts offline with expected-version conflict checks. Drafts allocate no final invoice number and change no stock, cash or customer amount due.

Product selectors exclude archived items for new lines; existing draft references remain readable and must be validated at finalization. Service items remain untracked. Preserve two/three-decimal money and scaled quantities. Country-specific tax field/calculation/e-invoice rules require a separate concrete regional specification; a generic tax rate is not a tax-compliance certification.

### B2 — finalize a retail sale and stock

For the first commercial workflow, **Finalize** means the sale is committed and goods are handed over immediately. Explicitly show this boundary in confirmation. Finalization freezes business/customer/item/tax/price snapshots, allocates one invoice number and writes stock-out movements exactly once in the same transaction. A tracked item cannot silently oversell: initially block insufficient stock and offer to correct/restock it first. This is distinct from the approved negative-cash policy.

Services change no stock. Concurrent finalization/duplicate clicks return the original result or a clear version conflict; errors roll back number, invoice and all stock effects. Do not add a separate delivery process that decrements the same stock again. Historical product edits do not change finalized invoices or their cost snapshots. Returns later use a linked credit/return workflow, not deleting finalized sales.

### B3 — settlement, customer dues and advances

Cashbook remains the money authority. Invoice **Record payment** creates/reuses one numbered receipt and links allocations to invoices; never independently insert a second money ledger. Plan the unique voucher↔payment bridge against existing payments/payment_allocations tables and finalized-invoice triggers before implementation.

One invoice may have many receipts; one receipt may pay many invoices. Allocation sum cannot exceed receipt available amount or each invoice's remaining due. Excess money is explicit unallocated customer credit/advance; later allocation changes no cash. Legacy cashbook receipts stay unallocated until the owner explicitly selects an invoice. Do not infer debt from receipt totals or names.

Example excluding tax: invoice2,000, receive1,200 → cash+1,200, due800, stock reduced once. Receive800 next week → cash+800, due0, stock unchanged. Reverse the800 settlement → cash−800, due800; invoice and stock remain. Wrong invoice allocation may be corrected without re-receiving money; retain audit evidence. Credit notes/returns/refunds have explicit links and separate cash/stock effects.

Customer screen keeps Cash history and adds Invoices/Amount to collect/Credit separately. Dashboard defaults Today and shows cash receipts/payments independently from invoiced sales and outstanding dues. Reports offer invoice status, due date/ageing and customer statement, with date/account meaning clearly labeled. No profit card based only on cash difference.

### P1 — supplier bills and purchasing

Reuse party identities with explicit supplier role/link rules. Add supplier bill drafts/finalization, purchase lines, goods receipt and payment allocations. For the first simple purchase flow, confirm whether goods are already received; avoid both bill save and separate goods receipt increasing stock. Supplier credit purchase adds payable and received stock, no cash. Later payment changes cash/payable, no additional stock.

Example: ten units at600 on credit → stock+10, payable6,000, cash unchanged; pay2,000 → payable4,000 and cash−2,000. Keep operating expenses distinct from inventory purchases, capital assets, loan principal and advances. Unpaid expense bills require obligations before they appear in cashbook. Fees/taxes and cost valuation need a declared accounting model before profit claims.

## Delivery and later decisions

Each phase needs its own implementation plan, red→green tests, native/web transaction and restore tests, independent review, scoped commit/push and actual CI inspection. Rebuild/distribute only checked candidates; public updater releases require version increments and a separately requested release publication.

Next design decisions beyond T1: regional invoice profile and numbering/year rules; invoice return/credit lifecycle; customer opening dues/credits; supplier identity model; purchase tax/cost treatment and historical valuation. Resolve them in their phase design before coding. Device synchronization remains explicitly deferred by the owner; it will need transport, authentication/pairing, encryption, device IDs, conflict/idempotency and invoice-number collision design, not copying SQLite WAL files between devices.
