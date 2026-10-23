# BillZen business integration blueprint

Date: 2026-10-23. Baseline: `5a2a6d0`. Status: **proposed design; not implemented**.

## Purpose and evidence boundaries

Make BillZen useful for an owner who wants to record money received and paid, issue receipts/payment vouchers, and understand the company without accounting jargon. Connect existing modules incrementally instead of rebuilding the app as an ERP.

This is a source and documentation audit, not a fresh runtime certification. Reviewed app routes, six main views, native catalog/cashbook commands and worker, migrations v1/v4/v7, browser adapters, backup model, roadmap and deferred invoice specification. Previous test results remain historical. No real business database was opened. Research references below inform workflow design, not a claim of legal/tax compliance.

## 1. What exists today

| Section | Actual implementation | Best current use | Missing connection |
|---|---|---|---|
| Dashboard | Today/month/year/custom cashbook views, account selection, receipts/payments charts | Daily money overview; drill into transactions | Invoice sales, reliable receivables, payables and inventory metrics need their own completed workflows |
| Cashbook | Money accounts, categories, parties, numbered vouchers, immutable snapshots, reversals, ledger, negative-balance confirmation | Record actual money received/paid, print evidence, track cash/bank balances | Customer linking UI, party statements, atomic transfers, invoice settlement |
| Reports | Period/account and other transaction filters, CSV, printable report | Review/export cash movements | Customer statements, overdue invoices, stock valuation and purchase reports |
| Products | Native product/category CRUD, price/cost/barcode, stock tracking, opening stock, threshold, archive/restore | Maintain goods/services catalog | Sale-driven stock movement, restocking/adjustment UI and stock history; browser catalog is memory-only |
| Customers | Native contact/address/tax fields, archive/restore, displayed balance field | Maintain a contact directory | Receipt action, party link management, transaction timeline and derived amount due; browser catalog is memory-only |
| Settings | Single business profile, regional/currency configuration, onboarding, language/appearance, backup/restore, update UI | Set business identity and preferences, protect data | Full durable web workspace, explicit workspace switching if multi-company is later required |
| Invoices | Schema/calculation/print foundations and deferred draft specification | Engineering foundation only | No commercial invoice route in the current app navigation |
| Purchases / vendors / expenses | Supplier party and expense voucher concepts; expenses table exists | Paid expenses through Cashbook | Full vendor bills, purchase receipt, payable allocation and unpaid-expense workflow |

**Important corrections to assumptions:**

- `cashbook_parties.customer_id` already exists. The gap is the supported workflow, uniqueness/link rules, queries and UI—not absence of every relationship.
- Native `create_customer` initializes `current_balance_minor` to zero; catalog updates preserve it. Do not interpret that displayed field as verified customer receivables today.
- `src/adapters/tauri.ts` uses `mockProducts`, `mockCustomers`, and mock categories outside Tauri. They are not durable web catalogs. Cashbook uses IndexedDB. Refresh persistence must be fixed before promising integrated web use.
- Web backup export reads those mock catalogs and emits empty arrays for invoices/stock/payments. Native backup enumerates those tables. Backup parity is therefore a prerequisite, not a completed integration guarantee.
- Browser restore currently writes business settings and cashbook tables, but does not restore catalog/commercial tables; its `restored_tables` response lists envelope keys more broadly than the actual writes. Do not rely on browser restore as a complete native-workspace round trip. P0 must correct both coverage and success reporting.
- `business_settings.id` is constrained to `default`. Changing the business name is not creating an isolated second company.
- Transfer exists as a classification but the ordinary voucher validator explicitly rejects it. Two unrelated manually entered vouchers are not an atomic transfer feature.
- `docs/roadmap.md` is partly historical: period reports and CSV/print are already present; do not rebuild those as if missing.

## 2. Operating model

Keep one business workspace, one base currency, one operator and independent local device data for the first integration release. An account means a place where money is held (Cash, Bank, Wallet), not a separate company. UPI/card is a payment method; it is not automatically a new account. Select the real destination account. Funds waiting for settlement need a separately designed clearing-account workflow.

Three independent business facts must remain distinct:

1. **Commercial documents:** what was sold/bought and what is owed.
2. **Stock movements:** what physical quantities entered/left the business.
3. **Cashbook movements:** money actually received/paid.

Products supply item details; Customers/Parties identify people or businesses. Invoices and bills connect these facts. Dashboard and Reports read them; neither should create duplicate financial records.

Recommended relationships (future design):

```text
Settings → business identity / base currency / timezone / document defaults
Customer ← explicit ID link → Cashbook party
Product → Invoice line → Finalized invoice → Customer amount due
                          ├→ Stock movement (goods handed over)
Receipt → Cashbook movement └← Payment allocation
Supplier → Purchase bill ← Purchase lines ← Product
                        ├→ Goods receipt → Stock movement
Payment → Cashbook movement → Bill allocation
All confirmed records → Dashboard / Reports / Statements
```

These arrows describe the target. Existing catalog creation does not execute this entire flow today.

## 3. How to use each section to its full potential

### Cashbook: the daily entry point

The first actions should stay **Receive money**, **Pay money**, and later **Transfer money**. Require amount, date and account; offer party, category, classification and reference with understandable defaults. Allow an anonymous walk-in receipt; do not force a product or customer for rent, utilities or owner capital.

Distinguish category (Rent, Sales, Utilities) from classification (Operating expense, Loan, Capital, Advance). A loan receipt increases money but is not sales. Owner withdrawal is not ordinary operating expense. Avoid designing loan principal and interest as one indistinguishable amount; split their classifications when that workflow is added.

Keep immutable vouchers and correction by linked reversal. Negative cash retains the approved warning-and-confirm policy. Every posting must be retry-safe and audit the confirmation. A confirmation must be revalidated against the current balance inside the transaction, not an old preview.

### Customers: a useful relationship page

Proposed customer page: contact information, linked cashbook history, Receive money action, statement export. Later add invoices, allocations, overdue amounts and reminder drafts.

Phase one displays **Received from this customer**, **Paid to this customer**, and **Net cash movement**. These are not **Amount due**. A receipt history cannot establish what the customer owed without invoices/opening receivables/credits.

Use explicit stable IDs, never automatic name matching. Same-name customers may be different people. Existing duplicate parties need an owner-reviewed mapping; preserve voucher snapshots. Initially keep Customers and Parties tables and use the existing bridge. Avoid an invasive unified-contact migration until supplier requirements justify it. One entity may eventually have customer and supplier roles; show receivable and payable separately instead of silently netting them.

### Products: goods and services

Maintain SKU/barcode, category, selling price and stock threshold for goods. Use untracked products for services such as installation or consulting. Product categories are merchandising groups; cashbook categories describe money purposes and should remain separate.

Product detail should later show stock history, purchase receipts, sales and adjustments. Do not change stock merely because money was received: an advance or old invoice collection is not a new sale. Draft invoices never move stock. For the first retail workflow, explicitly define finalization as sale plus immediate handover. Later delivery workflows must move stock on delivery instead; never both.

Editing a product's price/name must not rewrite an old invoice. Purchase price on a product is not enough to calculate historical profit; later valuation needs a declared costing method and movement cost history.

### Dashboard: answer a small number of questions

Default Today; keep simple and analytical modes, date/account filters and existing visual design.

Simple mode: received, paid, net movement, money available; two entry buttons; recent transactions. Explain period opening/closing versus current balance. Later show amount to collect/pay and low stock only when those measures are backed by implemented sources. Each card should open the matching filtered report and preserve date/account context.

Analytical mode: trends, category breakdown and account comparison. Label operating cash flow accurately. Do not label receipts minus payments as profit. Capital, loans, advances and transfers should be inspectable separately. Large values, zero periods and negative movement must remain readable on mobile and in both themes.

### Reports: trace every number

Keep existing CSV/PDF paths. Add party filters/statements first, then receivable ageing, supplier payables, stock movement and sales reports after their source workflows ship. A filtered transaction subtotal must not masquerade as the full account balance.

Every report records workspace, currency, business timezone, inclusive date range, filters and generation time. Use deterministic ordering (business date plus stable posting sequence). Exports must match displayed rows/totals and work offline. Reports must include a defined reversal policy: preserve original and reversing movements with labels; never exclude only one side and distort money.

### Settings and onboarding: keep the system trustworthy

Confirm business details, base currency/timezone, first account and opening amount. Then optionally add contacts and items. A cashbook-only business should finish setup without inventory.

Keep language/theme in Settings. Add a readable backup status and a tested restore workflow, not just an export-success toast. Backup is a copy, restore replaces a workspace, synchronization merges changes—these are different features. Independent phone/laptop entries do not automatically combine. A checksum detects accidental modification; it is not encryption.

## 4. Concrete workflows and numerical examples

All examples omit tax to make the relationships clear; use the configured currency.

| Business event | Money effect | Commercial/stock effect | Required behavior |
|---|---|---|---|
| Owner adds ₹50,000 | Cash +50,000 | No sales or stock | Capital receipt; keep out of sales/profit cards |
| Rent ₹5,000 paid | Cash −5,000 | Operating expense | One payment voucher, no product needed |
| Sell two items at ₹1,000; receive ₹1,200 | Cash +1,200 | Invoice 2,000; due 800; stock −2 | Finalize once; allocate receipt; never count invoice as a second cash receipt |
| Collect remaining ₹800 next week | Cash +800 | Due becomes zero; stock unchanged | Allocate to the same invoice |
| Move ₹10,000 Cash → Bank | Cash −10,000; Bank +10,000 | Company money unchanged | One transfer operation with two atomic legs; no sales/expense |
| Buy ten items at ₹600 on credit | No money yet | Stock +10; supplier due 6,000 | Purchase document plus receipt of goods; no premature cash payment |
| Pay supplier ₹2,000 | Bank −2,000 | Supplier due 4,000; stock unchanged | Allocate one payment to the bill |
| Customer advance ₹3,000 | Bank +3,000 | Unallocated credit/advance | Later allocate without receiving the same money again |
| Return one sold item | Refund only if money actually returned | Credit note; stock +1 only if accepted back into sellable stock | Credit, physical return and refund are separate linked actions |

The invoice/purchase/transfer rows are target workflows, not instructions to use unavailable buttons today. Existing Cashbook supports ordinary receipt/payment records; mark their references clearly until commercial integration ships.

Daily owner routine: record real receipts/payments → check account and party → attach/reference proof when supported → compare closing cash with physical cash → review exceptions → back up. Month-end: review classification, unreconciled differences, statements and backup restore evidence. Do not silently edit a balance to hide a discrepancy.

## 5. Data and transaction contracts

- Cashbook remains the authoritative money ledger. Reuse existing `payments` / `payment_allocations` only with an explicit unique link from each settlement to its cashbook voucher; do not build a second cash balance ledger.
- Proposed settlement operation takes invoice allocations, amount, account, party, business date and idempotency key. Validate allocated sum ≤ available receipt and outstanding invoice balances. Store unallocated credit explicitly.
- Native posting, allocation, sequence and any stock changes use one database transaction; the web equivalent uses one durable IndexedDB transaction covering all affected stores. No sequence of frontend calls that can stop half-complete.
- Replaying the same intent returns the existing result; reusing its key with different content fails. Print/share failures must not roll back a committed sale or trigger a second posting.
- Preserve finalized document snapshots and current reversal protections. Reversing a settlement must reverse its allocations as well as its money effect. Reversing payment alone does not return stock or cancel the sale.
- Opening cash, opening customer receivables and opening stock are separate migration events, with explicit dates and audit records; none creates new-period sales.
- Money uses integer minor units with 2/3-decimal currency rules; quantity uses existing scaled integers. Use existing checked Rust/TypeScript arithmetic and parity tests. Reject cross-currency aggregation/transfer in this first design.
- Native and web migrations, backup schema, import validation and rollback are part of each feature. A structurally valid checksum does not make invalid ledger relationships acceptable.
- Customer cash history joins linked parties by IDs and includes archived historical parties. If multiple legacy parties link to one customer, aggregate them without double-counting movements; do not silently discard them to enforce new uniqueness.

## 6. Prioritized delivery roadmap

| Phase | Deliverable | Completion gate |
|---|---|---|
| P0 — durable platform foundation | Persist browser catalogs and stock opening records; atomic complete workspace backup/restore; clarify unsupported fields | Create → reload → export → restore preserves IDs/relationships; interrupted restore preserves prior workspace |
| P1 — Customers ↔ Cashbook | Explicit linking, customer money timeline, receive-money shortcut, party-filtered report | One receipt visible consistently in Cashbook, Customer and Report; no duplicate party/posting; no false amount-due label |
| P2 — transfers and daily close | Atomic same-currency transfer, transfer receipt, cash-count discrepancy record | Two legs sum to zero; failure writes neither; company income/expense unchanged |
| P3 — sales and settlement | Existing deferred M4A drafts, then M4B finalization/stock, then partial allocations/advances | ₹2,000 sale example passes; drafts have zero movements; retries/rollback/reversals correct |
| P4 — purchasing and inventory | Supplier bills, goods receipt, partial payment, stock adjustments and returns | Credit purchase changes stock/payables without cash; later payment changes cash without stock |
| P5 — management reporting | Ageing, inventory valuation under chosen cost method, sales margin and reconciled management reports | Every total traces to source; profit terminology used only with defined cost/revenue/expense treatment |
| P6 — optional convenience | Attachments, reminder drafts, budgets, multi-company workspaces, optional sync | Separate specs for security, storage, conflicts and scope before implementation |

P0 is a web release prerequisite. Native P1 can be developed independently, but must not be advertised as equivalent on web until P0 passes. This adjusts the historical C2–C4 roadmap because contact linkage gives this owner immediate value; it does not automatically approve the deferred invoice milestone for implementation.

Split each phase into its own reviewed implementation plan. Do not implement all phases in one large rewrite. No framework replacement or cloud service is needed. Calendar estimates should follow the P0 storage/restore spike and the first P1 slice; no reliable whole-project completion date follows from this source review alone.

## 7. UX and platform acceptance

- Desktop: keyboard-friendly quick entries and tables; phone: concise forms, safe-area aware navigation and readable transaction cards; tablet: adaptive layout.
- Test 360/390/768/1280-width layouts, keyboard focus, Arabic RTL, light/dark/system themes and reduced motion. Motion must not delay money entry or hide totals.
- Use isolated synthetic workspaces for browser/native/Android tests. Browser success does not certify native printing, physical Android, Windows or macOS behavior.
- Test startup without network, refresh/restart, interrupted write/restore, duplicate taps, archive/history, daylight/timezone date boundaries, large amounts, zero and reversed periods.
- Regional settings do not imply tax certification. Country-specific invoice fields, tax treatment, electronic-invoicing rules and numbering must be researched against official authorities when that feature is scoped. No universal India/GCC tax switch is proposed.

## 8. First implementation slice

Start with the linked [foundation and customer-cashbook plan](superpowers/plans/2026-10-23-business-integration-foundation.md). It deliberately excludes invoice posting, transfers, profit and cloud sync. The owner should first be able to select an existing customer while receiving money and then inspect that customer's true cash history across supported durable platforms.

## 9. Research and local evidence

External workflow references checked 2026-10-23:

- [Zoho: record payment for an invoice](https://www.zoho.com/in/books/help/invoice/record-payment-for-invoice.html): separates invoice creation from payment recording. Used to inform explicit settlement actions, not online gateway requirements.
- [Zoho: record deposits](https://www.zoho.com/in/books/help/banking/deposits.html): cash-to-bank deposit is a transfer; receiving directly into the bank does not require another deposit. Supports avoiding duplicate receipts.
- [Zoho: link customer and vendor](https://www.zoho.com/in/books/help/contacts/link-customer-and-vendor.html): one contact can have both roles. BillZen should expose explicit identity links; its accounting/netting model need not copy Zoho's.
- [Odoo: customer invoices](https://www.odoo.com/documentation/17.0/applications/finance/accounting/customer_invoices.html) and [stock movement valuation](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/inventory_valuation/operations_valuation.html): search excerpts supported separate document/payment/stock concepts; full-page fetches timed out, so these were corroborating references only.

Local evidence map:

- `src/App.tsx`: current routes and synthetic invoice print fixtures.
- `src/components/{DashboardView,CashbookView,ReportsView,ProductCatalogView,CustomerCatalogView,SettingsView}.tsx`: current user workflows.
- `src/adapters/tauri.ts`: native catalog IPC versus browser mock collections and backup/export behavior.
- `src/adapters/web_cashbook_db.ts`: durable browser money ledger.
- `src-tauri/src/db/worker.rs`: catalog balance initialization, opening stock and cashbook posting.
- `src-tauri/src/db/migrations/v1_init.sql`: singleton settings, invoice/payment/stock foundations.
- `src-tauri/src/db/migrations/v7_cashbook_foundation.sql`: party bridge and money records.
- `src-tauri/src/domain/cashbook.rs`: ordinary transfer prohibition and classifications.
- `src-tauri/src/db/backup.rs`, `src/types/backup.ts`: backup coverage/contracts.
- `docs/m4a-invoice-drafts-spec.md`, `docs/roadmap.md`: deferred scope; not evidence of shipped invoice functionality.
