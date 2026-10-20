# Cashbook UI-3 — Precision Ledger

2026-10-20. Continues the owner-approved direction after UI-2.1 (`aa118aa`). This section changes presentation and interaction accessibility; financial domain functions, adapters, schema, idempotency, ledger scope, reversals and printable documents retain their contracts.

| Before | After | Why |
| --- | --- | --- |
| Independent slate/indigo/purple surfaces | Existing semantic forest/lime surfaces, emerald receipts and coral payments | Cashbook now belongs to the approved shell and Dashboard |
| Two summary columns even at 320px | One below 400px, two on larger phones/tablets, four on wide desktops | Large balances retain all digits |
| Receive/Pay/Accounts competed for one narrow row | Full-width actions at 320px; progressive grid/flex layout above | Malayalam labels remain readable and touch-sized |
| Hardcoded screen copy and enum labels | Typed Malayalam/Arabic translations alongside English | Labels, filters, dialogs and confirmations follow app language; user-entered names remain intact |
| No dialog names, focus containment or associated optional-field labels | Named dialog shell, label associations, initial focus, Tab/Shift+Tab containment, trigger return and background isolation | Nested category/party/negative-balance flows remain usable by keyboard and assistive technology |
| Row-wide opacity on reversed records | Readable amounts with explicit reversal/void badges | Historical financial information stays legible |
| Zero summaries during initial loading/errors | Unavailable marker and explicit loading/retry states | A failed read must not look like a zero balance |
| Browser banner said reload deletes data | Explains device/browser-local storage and site-data deletion risk | The existing browser adapter uses IndexedDB; the reload/backup test confirms persistence |
| Dark coral `#ef4444` measured 4.44:1 on a populated row | Dark semantic coral `#f87171` | Normal financial text needs at least 4.5:1 |

Dashboard Add Payment had a pre-existing stale form-state defect: the displayed select defaulted to an expense option while submitted state retained `operating_income`. A browser submission reproduced the direction/classification rejection. Both dashboard shortcuts now use the same form initializer as Cashbook actions after accounts load. The regression posts a real synthetic payment to verify submitted state, not just the displayed option.

## Interaction boundary

`CashbookDialog` owns focus, scroll locking and reversible background `inert`/`aria-hidden` leases. Reference counts preserve prior state through nested dialogs. Moving focus before hiding the background avoids hiding the active control. Deferred focus return handles simultaneous entry/confirmation dismissal. The existing `useBackHandler` retains Escape/Android Back order. CSS targets the screen only; on-screen fixed paper previews scroll independently.

Application-owned copy lives in `src/i18n/cashbook.ts`. Identifiers, party/account names, stored snapshots and raw backend error details remain intact. This is not a translation of the printable document contract. Native screens still use SQLite; browser storage and native storage are separate local workspaces, not synchronization.

## Motion and skills used

Cashbook is a frequently used financial tool. No new animation engine, page choreography or dependency was added. Existing short color transitions and occasional feedback remain; reduced-motion removes transforms. No delay is added to typing, posting or reading amounts.

- Superpowers executing-plans/TDD/verification: scoped implementation plan, observed failing dialog-name and nested-accessibility tests, verified fixes, final independent review.
- Karpathy Guidelines: preserve business boundaries and avoid a framework rewrite.
- Anti-slop / frontend-design: restrained approved palette, clear real-value hierarchy and no decorative metrics or gradients.
- UI UX Pro Max: ran the installed local `search.py` query `modal keyboard focus trap --domain ux`; applied visible focus and unobscured keyboard controls, plus installed touch/layout guidance.
- Impeccable: read installed adapt/harden references; applied narrow-screen reflow, long translations, large values and local error visibility. No claim of a complete formal `critique`/detector command run.
- Emil Design Engineering: used frequency-based motion restraint; this before/after review records the concrete changes.
- Installed Taste Skill v2 explicitly excludes dashboard/app screens; its marketing-gallery workflow was not applied to this migration. Existing approved art direction is retained.

## Review and verification

Independent review found no changed financial/adapters/print contracts. It found background accessibility exposure, unnamed category/party selects and remaining English enum labels; these were corrected. The new browser regression checks translated headings, actual populated balances, named selectors, invalid-amount feedback, nested focus/escape/return, accessible background isolation/restoration, scroll restoration and large-amount overflow. Screenshots use synthetic data only, under ignored `test_artifacts/cashbook-ui3/`.

The PDF harness now initializes its guide-completed test state deterministically and closes its browser in `finally`; onboarding remains independently tested. Tests must not regenerate `dist/` while another preview suite is reading it. Full results and native build identity are recorded in `docs/verification-status.md` after completion.

Android signing, version codes, updater manifests and public releases are outside this section. Browser/Linux results do not certify Android, Windows, macOS or iOS.
