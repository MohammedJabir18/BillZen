# Product requirements · BillZen

Version 0.1 · 18 October 2026 · Working product specification, not a completion report.

## Product intent

Give retail shops, freelancers and small businesses an independent workspace for catalog management, billing, inventory and customer credit. The core business workflow must remain usable without an internet connection or cloud account. India and the six GCC countries are intended markets.

### People and primary jobs

| Person | Job to complete | Product consequence |
| --- | --- | --- |
| Shop owner/cashier | Find or scan a product and complete a sale quickly | Keyboard-first flow, exact totals and clear save/finalize states |
| Freelancer/service business | Create and recover a draft, then issue a clean document | Service items may be untracked; invoice snapshots preserve history |
| Owner/bookkeeper | Understand dues, stock changes and expenses | Derived balances, traceable movements and reconciled reports |
| Multilingual operator | Read and enter business data comfortably | English/Malayalam/Arabic resources, RTL and localized input testing |

## Functional requirements

| ID | Requirement | Acceptance target | Current state |
| --- | --- | --- | --- |
| F01 | Configure business identity and currency | Save/reopen settings; reject unsupported currency/exponent pairs | Foundation implemented |
| F02 | Manage products and customers | Create/edit/search/archive/restore with validation and preserved identifiers | Implemented catalog |
| F03 | Categorize products | Consistent name policy; existing-data upgrades preserve product references | V5 index implemented; duplicate-upgrade correction required |
| F04 | Establish inventory balances | Opening stock commits with its ledger movement; invalid transitions rejected | Foundation implemented |
| F05 | Build invoice drafts | Select customer, scan/search item, change quantity and save/recover draft without stock mutation | M4A planned |
| F06 | Finalize documents | Allocate unique number and immutable snapshots atomically with stock movements | M4B planned |
| F07 | Apply commercial adjustments | Defined ordering for tax, discounts and fees; Rust/TypeScript calculation parity | Arithmetic foundation; workflow pending |
| F08 | Record partial payments | Idempotent payment allocation; no unexplained balance mutation; clear receipt | Planned |
| F09 | Record expenses | Validated amount/category/date; traceable corrections and reconciled reports | Schema only |
| F10 | Explain business performance | Revenue, receivables, low stock and profit figures trace to persisted records | Planned |
| F11 | Export and print | Reliable A4 document, later thermal formats; explicit native/hardware verification | A4 component + browser fixtures |
| F12 | Back up and restore | Validate backup, restore into safe staging, preserve recoverability on failure | Planned |
| F13 | Work on intended platforms | Native persistence, restart recovery and printing acceptance on each target | Linux development evidence only |
| F14 | Optional synchronization | Core stays local; explicit sync state/conflicts, retries and account independence | Planned |

### Inventory policy

Untracked items have zero opening stock. Enabling tracking requires current stock to reconcile with movement history. Never silently manufacture an audit movement to conceal a historical discrepancy. Any repair workflow must explain the source and preserve a record of the correction.

### Financial policy

Store currency minor units as integers and quantities scaled by 1,000. Keep code/exponent validation explicit. Domain bounds must match across form parsing, native commands and calculations. Finalized commercial data must remain stable when catalog/settings change. Credit/settlement state should derive from invoice/payment allocations rather than a separately editable balance.

## Quality requirements

| Quality | Acceptance approach |
| --- | --- |
| Offline operation | Disconnect networking and complete supported native catalog and future invoice flows; include restart checks |
| Responsiveness | Benchmark representative catalog sizes on named reference hardware; define budgets before asserting numerical speed claims |
| Durability | Test commit/rollback, restart, interrupted writes and migration upgrades using isolated databases |
| Accessibility | Keyboard operation, visible focus, semantic labels, readable contrast and reduced-motion alternatives |
| Regional UX | Test 2/3-decimal currencies, leading-zero barcodes, Malayalam glyphs, Arabic RTL and localized input |
| Security | Runtime command denial tests, strict input validation, no leaked secrets/customer data and safe restore handling |
| Packaging | Measure signed/native host artifacts; package size is measured per platform and format |
| Portability | Run native acceptance per OS; shared source alone does not establish platform parity |

No measured latency, load or bundle-size service level is established by this document. The requested sub-15 MB distribution is a target to measure, not a blanket release claim.

## Scope and sequencing

1. Close the legacy category migration gap and expand boundary coverage.
2. Deliver one recoverable draft invoice workflow (M4A).
3. Deliver atomic invoice finalization and inventory movement (M4B).
4. Add payments, expenses, reconciled analytics and backup/restore.
5. Validate platform expansion and country-specific integrations.

Do not start cloud sync, an AI feature, a new server framework or a large UI redesign during the migration/draft vertical slices. Mobile must eventually be a standalone offline product, not merely a read-only companion. Durable web storage needs an explicit adapter; current browser mocks do not satisfy it.

## Regional constraints

Currency and localization support do not certify GST, VAT or statutory e-invoicing behavior. Jurisdiction-specific issuance/submission requirements must be researched against current official sources before implementing or promising a compliant workflow. Offline business continuity must be reconciled with those requirements, not assumed to override them.

## Milestone definition of done

Each milestone needs its accepted user journey, failure/rollback cases, migration compatibility, relevant automated checks, explicit platform limitations, updated documentation and a verified GitHub checkpoint. A green test count without the relevant upgrade scenario is insufficient.

See [technical design](technical-design.md), [roadmap](roadmap.md) and [verification status](verification-status.md).
