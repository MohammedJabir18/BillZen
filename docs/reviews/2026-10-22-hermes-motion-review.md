# Hermes motion pass: independent review

Date: 2026-10-22. Verdict: **do not distribute this motion pass yet**.

## Scope and evidence

Reviewed the uncommitted changes in AppNavigation, DashboardView and CashbookView against HEAD `fb43fa81ff38e859827b6018828f2db64e326e96`. This is a review of pending working-tree code, not an approved release. No application code, user records, signing configuration or installers were changed by this review.

Fresh verification:

- `npm test`: 12 files, 72 tests passed.
- `npm run build`: passed. Main JavaScript 718.67 kB, gzip 193.19 kB; existing chunk-size and mixed import warnings remain.
- `npm run test:cashbook-ui`: 55 assertions passed using synthetic browser records.
- Separate Playwright audit of the freshly built browser preview reproduced navigation and animation regressions below. Used isolated browser storage, not the native business database.
- `git diff --check`: failed on four trailing-whitespace lines in AppNavigation. Build success does not establish visual correctness.
- Native Linux/Windows/Android runtime, physical printing, RTL and the full language/theme matrix were not verified for this pending pass. Existing installer files were not rebuilt.

Local evidence, intentionally ignored rather than committed: `test_artifacts/hermes-motion-review/evidence.json`, `mobile-initial.png`, `desktop-after-resize.png`, `dashboard-after-rapid-filters.png`, `mobile-settings-selection.png`. Temporary audit runner: `/tmp/billzen-hermes-motion-audit.mjs`. Temporary logs: `/tmp/billzen-hermes-motion-audit.log`, `/tmp/billzen-hermes-cashbook-ui.log`.

## Findings, in priority order

### P1 — Mobile bottom navigation is no longer fixed

`src/components/AppNavigation.tsx:167` combines `fixed` and `relative`. In the generated stylesheet, relative wins. At 390 × 844, computed position was `relative` and navigation started at y=1628.25, entirely below the initial viewport. This affects basic access to app sections, not just appearance.

Remove the conflicting positioning utility while keeping a suitable containing block for the capsule. Recheck scrolling, safe-area padding, dialogs and all mobile destinations.

### P1 — Interrupted summary animations leave financial cards almost invisible

`src/components/DashboardView.tsx:118` and `src/components/CashbookView.tsx:176` repeatedly call `gsap.from` as dependencies change. The installed useGSAP hook defers cleanup until unmount when dependencies are present and `revertOnUpdate` is absent. A new tween can capture a partially animated value as its final destination.

Reproduction: after an initial settled Dashboard, switch Month → Year → Today → Month at 45 ms intervals; wait another second. Card opacity remained 0.1278, 0.0045, 0.0596 and 0, with y offsets around 17–20 px. Screenshot confirms missing/faded financial summaries. The same tween pattern exists in Cashbook; its rapid-update sequence needs a regression check too.

Use a scoped cancellation/reversion/overwrite strategy with explicit settled values. Ensure filter changes, refetches, view changes and interrupted animations always finish at opacity 1, y 0, scale 1. Do not delay or animate the correctness of financial values.

### P2 — Active navigation capsule does not track responsive geometry or More destinations

Desktop geometry is measured only on activeTab/language changes. After opening at mobile width and resizing to 1280 px, the desktop capsule remained width 0 despite its active button being 204.66 px wide. Resizing a healthy desktop from 1280 to 1100 px left a 205 px capsule on a 174.66 px button.

For mobile Settings/Products/Customers, the query looks for a primary tab that does not exist in the bottom bar, so the previous capsule remains. After Reports → More → Settings, the pill stayed at x=197 (Reports), whereas More was x=291.5.

Observe actual container/button geometry, account for hidden-to-visible breakpoint changes, and map secondary destinations to More. Check keyboard navigation, resize, language changes and RTL independently.

### P2 — Reduced-motion handling is incomplete; leftward capsule motion can collapse

Reduced motion is sampled only when effects run. Turning the preference on during a running transition did not stop it: the capsule moved from x=243.87 to x=403.82 over the next 110 ms. Subscribe to preference changes and settle all relevant effects immediately; clean up subscriptions/tweens on unmount.

The navigation timeline also uses `scaleX: 1.05 * direction`; a leftward direction targets a negative scale, crossing zero and mirroring/collapsing the layer. Direction should control edge/origin movement without a signed scale crossing zero. The implementation does not yet establish the reference video's clipped leading/trailing-edge behavior or hover fidelity.

### P2 — Restoration introduced malformed color classes and text/test drift

Dashboard contains malformed arbitrary-value classes such as `text-[var(--text-subtle]`, `text-[var(--text-muted]` and `text-[var(--text-main]` at lines 714, 790, 843, 860, 863, 928, 975 and 1003. Missing closing parentheses prevent the intended color tokens from applying. Check both themes rather than changing the palette.

Cashbook line 1544 renders an extra literal `)` after the negative-balance confirmation label. At line 1663, the existing checkbox test ID changed from `checkbox-new-account-allow-negative` to `checkbox-new-account-Lbalance`. Restore stable test selectors unless an intentional change is documented and all consumers are updated.

## What Hermes's message establishes

The current Cashbook file has 1906 lines versus 1888 at HEAD; it is not currently truncated. It imports and uses useGSAP for summary-card entry animation. Independent build/unit/UI checks above pass.

Git does not contain the intermediate corrupted state, so “fully restored” cannot be historically proven from this diff alone. No translation resource files changed, and the compared translation-key usages in Cashbook/Dashboard did not change from HEAD. Translation repair may refer to an intermediate edit; it is not independently evidenced by the final diff.

There are three untracked files whose literal names end with a backtick: AppNavigation.tsx`, CashbookView.tsx` and DashboardView.tsx`. They contain malformed intermediate source and are not active `.tsx` inputs. They were not deleted during review. Inspect and deliberately clean them up before staging; do not use a broad `git add .`.

No direct financial calculation, database, updater or print implementation change was identified in this diff. That is a static scope observation, not a substitute for full platform regression testing.

## Next task to give Hermes

> Treat this review as a repair task before adding further animations. Read AGENTS.md, brain/sessions.md, brain/architecture.md, the motion specification and this review. Discover applicable installed global and BillZen-local SKILL.md files and report their actual paths and applicability; do not pretend to invoke unavailable tools. Preserve the existing layout, colors, business logic, SQLite data, translations, printing, updater and signing identities. Fix the navigation positioning, interrupted-tween final states, responsive capsule measurements, More selection, live reduced-motion behavior, signed-scale collapse, malformed color utilities and accidental Cashbook text/test-selector drift. Inspect the three trailing-backtick backup files and remove only confirmed accidental artifacts. Use focused regressions that first reproduce the broken behavior. Test rapid repeated filters/refetches and route changes, mobile scrolling, hidden-to-visible breakpoints, resize, keyboard/touch, reduced-motion changes, light/dark and RTL. Scope/clean up all GSAP effects. Run unit/build/Cashbook UI checks and relevant layout/theme/print checks; capture browser evidence and distinguish it from native-platform testing. Inspect the final diff, update brain/session documentation, stage only intended files, commit/push the coherent repair and inspect CI according to AGENTS.md. Do not publish a release or claim existing APK/desktop installers were refreshed without an actual verified build. Finish with a concise evidence-based handoff and remaining limitations.

The next step is **repair and re-verify**, not expanding tactile feedback to more controls. A later animation expansion should start only after the financial cards and navigation remain usable under interruption and responsive changes.

## Follow-up: Codex completed the repair

Hermes addressed several initial findings but left mobile label occlusion, live reduced-motion cancellation and lifecycle gaps. Codex reproduced those plus long-press geometry and keyboard More failures before fixing them. Final browser motion14/14, unit72, Cashbook UI55, Reports UI68, full layout816, theme96 and PDF checks passed; the initial parallel-suite timing failures are recorded in `docs/verification-status.md`. Independent final static review found no remaining actionable finding. Native runtime/installers and further drawer/dialog animation work remain separate. See the implemented boundary in the motion spec and the final verification record; the findings above describe the earlier state rather than the repaired code.
