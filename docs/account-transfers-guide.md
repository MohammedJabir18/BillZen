# Move money between company accounts

Use **Cashbook → Transfer money** when money moves between accounts belonging to the same company: cash deposited into the bank, bank cash withdrawals, or moving money to a company wallet. A customer receipt belongs under **Receive Money**; rent or another outside payment belongs under **Pay Money**.

1. Choose **From account** and **To account**. They must be different active accounts in the company's base currency.
2. Enter the amount and business date, with an optional reference and note.
3. Select **Review transfer**. Check both projected balances and the unchanged company total.
4. Select **Confirm transfer**. If the source would become negative, read the live-balance warning and explicitly allow it, or use **Edit details** to correct the transfer. The app checks balances again when posting.
5. Inspect the two ledger entries sharing a `TRF-…` number. **View / Print** on either entry opens the complete transfer. **Print / Save PDF** produces the A4 document using the original business/account names.

For example: Cash ₹5,000 and Bank ₹1,000, transfer ₹2,000 Cash→Bank, gives Cash ₹3,000 and Bank ₹3,000. Company money remains ₹6,000. Receipts, payments and operating cash flow stay unchanged.

## Correct a posted transfer

Open either leg's complete transfer, choose **Reverse complete transfer**, read the explanation and confirm the paired reversal. The reversal uses today's business date and the same amount with accounts swapped. It retains the original records and creates a linked opposite pair; it does not delete history. An individual transfer leg cannot be reversed as an ordinary voucher. Repeating a completed reversal returns the existing reversal.

If posting reports that the result is not confirmed, use **Retry** in the same dialog. It preserves the request identity, including after closing and reopening that dialog within the current screen. Do not create a second transfer for the same movement. An uncertain intent is locked against editing; a known unwritten negative-balance warning remains editable. Navigating away or restarting can discard an unconfirmed UI draft: inspect the ledger before re-entering it.

## Read Reports and Analytics

Transfers appear in account statements with their shared number and direction. Reports/PDF have a separate Transfer amount column; CSV adds **Transfer In**, **Transfer Out** and **Transfer Number**. Receipt/payment subtotals and analytics bars exclude transfers. Account opening/closing balances include them, and **Net cash change = Closing − Opening**. The dashboard explanation includes the signed net transfer effect when an account is selected.

Use Today, This Month, This Year or a custom range, then select the account. With All accounts selected, the two transfer effects cancel. A transfer-only account can have a changed balance and no receipt/payment bars; this is expected. This is cash movement, not business profit.

## Back up and update

Use **Settings → Export backup** for a complete workspace1.1 archive. Transfer-free1.0 archives remain importable. The app rejects broken pairs, changed snapshots, half reversals and invalid checksums without replacing the current workspace. Devices continue to have independent local data; no synchronization is introduced.

Source pushes do not update installed applications. Local desktop/APK candidates must be rebuilt and installed; automatic updater distribution additionally needs a higher-version published release. Existing Windows/macOS installers are not updated by a Linux build.
