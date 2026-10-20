# UI-3 — Precision Ledger Cashbook

> Execute inline using executing-plans. Existing owner approval covers the Precision Ledger direction and continuing implementation. Preserve the owner's main-branch delivery workflow.

**Goal:** Bring the working Cashbook into the approved design with usable narrow/RTL layouts, localized screen copy and accessible nested dialogs. Preserve financial calculations, adapters, idempotency, negative-balance confirmation, reversals and print documents.

**Architecture:** Existing React/Tailwind semantic tokens; a small reusable dialog shell manages focus/scroll while the existing back-handler retains Escape/Android Back order. Cashbook-specific typed translations remain separate from financial data. No database, dependency, signing or release changes.

## Tasks

1. Establish baseline: inspect latest handoff, clean tree and CI; run current unit suite.
2. Add a meaningful browser regression for narrow populated Cashbook, three languages and nested-dialog focus/return. Observe relevant failure before implementation.
3. Implement semantic surfaces, restrained feedback, wrapping monetary values, logical RTL spacing, 44px actions, bounded dialogs and localized copy. Preserve IDs and English workflow labels used by existing tests.
4. Run new and existing Cashbook, layout, contrast, responsive, dashboard and print checks; inspect mobile/desktop/RTL screenshots. Rebuild Linux and verify native cashbook against isolated data.
5. Fresh-context review of the completed section, address substantive findings, update verification/skill usage and second-brain notes, attempt Graphify sync with honest fallback, commit/push main and inspect CI.

## Verification boundaries

Browser tests exercise ephemeral preview data. Native acceptance uses an isolated SQLite database; never the owner's records. Android APK is not rebuilt or published in this section. Linux-native results do not certify Windows/macOS/Android. Reuse existing layout/contrast harnesses rather than testing literal CSS classes. New tests cover observable behavior, focus containment, translation and large-value readability.

## Rulings

- Work in the current clean main checkout: AGENTS explicitly requests completed logical sections committed/pushed on main; no competing owner changes exist.
- Do not reopen approved art direction or add new dependencies. Installed taste-skill v2 excludes app/dashboard screens; its marketing workflow is not applicable. Appropriate installed design guidance and the approved token system govern this screen.
- User-provided names, audit data, voucher identifiers and backend error details remain intact; translate application-owned copy only. Print content is a separate existing document contract.
