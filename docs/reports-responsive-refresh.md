# Reports and responsive navigation refresh — 2026-10-23

## Scope

Keep the financial engine, existing brand colors, reports/export semantics and other screen layouts intact. Restructure Reports filters and reuse the main navigation's interruptible capsule on comparable selection controls.

## Behavior

- Reports separates period/date/account selection from transaction detail filters. Search and counterparty share a primary row; four labelled filters form a balanced secondary grid (one, two or four columns according to available width).
- All filters remain directly available. Search, reset, archived-party selection, CSV and print retain their existing behavior.
- Reports and Dashboard periods, Dashboard Simple/Analytics and voucher A4/80mm selection use `AnimatedSegmentedControl`. Appearance cards reuse the same motion hook without changing their layout.
- The capsule retargets one timeline from its current geometry. It measures physical button offsets for RTL, handles font/container changes, and settles immediately for keyboard input or reduced motion. Buttons retain native semantics and `aria-pressed`; segmented groups additionally support Arrow/Home/End navigation.
- Main content reserves the measured bottom navigation height plus24px. Removing the competing `sm:py-6` utility prevents that clearance being overwritten. Short windows release the sticky header; native minimum geometry is360×360 instead of980×640.
- Wide statement tables scroll within their own region; the whole page does not overflow horizontally.

## Evidence and reproducible checks

`npm run test:reports-refresh` uses only isolated browser-site data. It seeds35 synthetic transactions, checks period capsule movement/alignment/interruption, keyboard selection, reduced motion, no page overflow, and the last row's actual position above bottom navigation at360×420,900×440,1080×540 and1440×900. It also checks Dashboard/Appearance capsule alignment and captures Reports filters in both themes. Existing Reports, transfer, responsive and motion suites remain separate regression gates.

The chart replay observer is scoped to the chart. Whole-document mutation sampling incorrectly included the new period capsule's style changes and sampled already-settled bars from the previous pending query; assertions still require every positive bar to start at the baseline, grow and finish at full scale.

Generated screenshots/logs are under ignored `test_artifacts/reports-refresh/`. Physical Android, Windows and macOS runtime behavior is not established by browser tests or a Linux binary build.

## Primary references

- [WAI-ARIA radio-group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/): keyboard-selection guidance; the implementation deliberately retains its existing toggle-button semantics rather than claiming radio roles.
- [WAI-ARIA toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/): grouping and clear accessible control names.
- [GSAP matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/): responsive/reduced-motion lifecycle guidance. BillZen retains its existing explicitly cleaned-up media listener and timeline ownership rather than adding another motion engine.
