# UI-4 — Reports and Settings language

Continues owner-approved Precision Ledger. The owner explicitly requests language selection in Settings and removal of platform/framework labels from the application shell on every platform.

| Before | After | Why |
| --- | --- | --- |
| Header language selector and Desktop/Android/Tauri/Browser badge | Language preference only in Settings; clean shared header | Keep the daily workspace focused on business tasks |
| Polling diagnostic footer with IPC/SQLite/milestone text | Diagnostic footer removed, including unnecessary ping polling | Implementation details do not help business owners |
| Reports used independent indigo/slate palette | Existing semantic forest/lime, receipt green and payment coral | Match Dashboard and Cashbook |
| Unnamed filters and crowded narrow date controls | Named 44px controls, stacking custom dates and wrapping financial summaries | Keyboard, touch, RTL and long translations remain usable |
| Category option value was a name while transactions used IDs | Category selection uses ID, with human-readable screen/CSV/PDF names | The old filter could discard every matching transaction |
| Failed/pending read could show zero and enable export | Unavailable marker, retry/validation and export readiness gates | Never export fabricated balances or unresolved category IDs |

Language remains a device-local UI preference in the existing App state/localStorage. Settings changes apply immediately and persist across reload; changing language does not change currency, timezone or company data. Initial setup retains language choice. Shared shell removal applies to desktop, Android and browser renderers. Functional update instructions remain; no platform badge or diagnostic branding remains in the shell.

Reports retain full-period statement totals while detail filters alter matching transactions. Category mapping is optional presentation metadata on CSV/print inputs, preserving existing callers, formula-injection protection and financial values. Arabic date labels now explicitly use the Gregorian calendar to match the stored business dates. The financial table is an explicitly labelled, keyboard-focusable horizontal scroll region on narrow screens; monetary summaries wrap without dropping digits.

Existing installed frontend-design/Anti-slop guidance and Impeccable adapt/harden references inform restrained hierarchy, reflow and edge states. No new animation dependency or art direction was introduced. Superpowers execution/TDD/independent review and verification govern delivery. The installed Taste Skill v2 excludes app/dashboard screens; its marketing-gallery workflow is not applied.

Observed regression failures: header language control present; category option value/name mismatch; CSV ID-to-name presentation; ready ledger exporting before category labels resolve. The CSV fixture initially omitted a running balance; after fixing that fixture, the intended category-name assertion failed and then passed. Independent review found the lookup-readiness gap; it is covered by a pending/ready unit regression.

Automated browser evidence and screenshots: ignored `test_artifacts/header/` and `test_artifacts/reports-ui4/`. Full results, packaging/version identity and platform limitations are recorded in `docs/verification-status.md`. Existing physical printer and real Android handset acceptance are distinct from PDF/emulator verification.
