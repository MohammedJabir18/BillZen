# Sales / Invoice drafts

B1 is implemented in the current source. Published desktop0.1.6 and Android0.1.5 installers are unchanged; a source push does not update an installed app.

Open **Sales → New draft**. Choose a customer or Walk-in customer, set the business date, and search products by name, SKU or barcode. An exact barcode/SKU followed by Enter adds the product and focuses quantity. Use Add custom item for a service/ad-hoc line. Quantities allow three decimal places; prices/discounts follow the company currency exponent. Tax input is a generic percentage, not a regional compliance certification.

Save draft persists it offline. Close, hold another draft, then Resume any saved draft. The editor displays saved/unsaved state. Preview is clearly marked DRAFT and has no final invoice number or payment claim. Creating, changing or deleting drafts never changes stock, cash, customer debt or final numbering.

A stale saved version is rejected. Your edit stays in the editor alongside the newer saved version; explicitly choose Reload saved version and confirm discarding the local edit if appropriate. An uncertain save locks that exact request for retry. A lost update response may return a conflict on retry: review the persisted version rather than repeating a new sale. Deleted drafts reserve their creation key permanently.

Unsaved recovery is a local editor aid carrying source draft ID/version, original currency and pending request. Review recovered edit explicitly. It cannot overwrite saved data without a version check. The browser grants one Sales editor tab ownership at a time so tabs cannot erase each other's recovery. Close/leave the other Sales tab and Retry editor to transfer ownership. Browsers without Web Locks cannot open the editor safely; use a supporting browser or the native application. Native recovery uses an atomic app-local file, honoring the isolated desktop data directory; browser recovery uses IndexedDB. Recovery is not part of the portable workspace backup and is not an authoritative invoice.

Company currency is bound to every new save intent. If settings change while an unsaved draft is open, save rejects without reinterpreting prices. Keep the edit for reference, or explicitly discard it and open a new draft using current settings.

Delete draft requires confirmation and the current saved version. Archived references already on a draft remain readable with warnings; new customer/product selections exclude archived records. Finalization must revalidate them in a later phase.

Workspace backup1.2 preserves saved drafts, line items and create/delete retry history. Native/browser restore validates checksum, ownership, versions and exact totals before replacement. Legacy transfer-free1.0 and transfer1.1 imports remain supported; older applications may reject1.2 rather than lose its journal. Protect exported JSON: it and the native database remain unencrypted.

Finalization, stock posting from sales, invoice payments/receivables, supplier bills, statutory tax profiles and device synchronization are separate later phases. This screen offers none of those actions.
