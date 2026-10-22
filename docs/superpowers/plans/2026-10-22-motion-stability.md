# Motion stability completion plan

**Goal:** Complete the existing approved motion pass without changing layout, palette, financial behavior or distribution identities.

**Architecture:** Keep GSAP decorative. Share navigation geometry/lifecycle handling between the desktop and mobile renderings; scope and revert summary/chart effects on updates. Keep native data and print documents outside this change.

**Spec:** `docs/superpowers/specs/2026-10-22-motion-pass-design.md`; independent findings in `docs/reviews/2026-10-22-hermes-motion-review.md`.

**Constraints:** Preserve existing colors, copy, functional navigation timing, database, signing and updater. Keyboard/reduced-motion actions settle immediately. Browser evidence does not establish native platform acceptance. Continue the user's pending main-branch work in place.

## Tasks

1. Add a real-browser motion regression script before implementation. Pin selected mobile label visibility/layering, live reduced-motion settling, rapid card/filter updates, breakpoint geometry, secondary destinations and RTL. Observe failures against Hermes's repaired build.
2. Fix navigation lifecycle with one shared hook: stop owned timelines before retarget/settle, update geometry without animation on resize/fonts, observe buttons as well as container, and clean up listeners/tweens. Keep selected text above the capsule and preserve readable semantic colors. Use separate leading/trailing clip edges for the approved reference motion; avoid signed scales.
3. Scope summary/chart effects, cancel/revert them on dependency changes, and respond live to reduced motion. Include asynchronous chart data readiness. Re-run browser regressions, Cashbook/dashboard behavior, layout/theme and print checks.
4. Inspect the complete inherited diff, record evidence/limitations and memory, commit only intended files, push main and inspect CI. Do not rebuild or publish installers as part of this repair.

## Review focus

- Switching reduced motion during a running tween stops it immediately, including summary cards.
- Active labels/icons remain visible with sufficient contrast above decoration in both themes.
- Resizing across a hidden breakpoint, fonts loading and RTL all align the capsule with the actual button.
- Repeated filters/refetches/routes do not retain stale timelines or leave financial cards faded.
- Printable documents retain static geometry and values; real records are never used as test fixtures.
