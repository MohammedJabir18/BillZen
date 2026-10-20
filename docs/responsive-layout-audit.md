# Responsive layout audit — 2026-10-20

## Scope

The owner's reported navigation and responsiveness defects were reproduced against the C1.5 source at `a31b95c`. This correction changes the shared React UI used by web, Linux desktop and Android. Real business records are never opened by the browser matrix; all contexts and exported backup fixtures are synthetic.

## Reproduced defects and corrections

| Defect | Correction |
| --- | --- |
| Seven mobile actions exceeded the 320px viewport; header brand overlapped controls | Three primary actions plus More; bounded secondary sheet; narrower mobile header controls |
| Desktop header overflow around 1024px, especially Malayalam labels | Separate seven-column navigation row with wrapping labels and 44px targets |
| Dashboard custom-range end date clipped at 320px | Stack native date controls on narrow phones; remove masking overflow clip |
| Large two/three-decimal amounts overflowed Dashboard/Reports cards | One summary column below 400px and wrapping amounts |
| Guide exceeded 568×320 landscape screen | Bounded panel, scrollable body, persistent header/footer |
| Backup restore and negative-balance confirmation exceeded short screens | Bounded scrollable panels, including related cashbook confirmation/category/party dialogs |
| Malayalam restore actions exceeded 320px | Wrapping action row |
| Long account names pushed Reports filters outside 1024px | Wrapping toolbar and bounded selector width |
| Android Back reached the closed guide and raised an initialization error | Ignore guide back events while the guide is closed |
| A4 preview left edge was unreachable on phones | Start-aligned horizontal paper scroller with non-shrinking centered-when-fitting paper |
| Restore action hovered at 3.76:1 contrast | Darker red hover state |

## Verification

The new layout harness first failed against the old shell (42/42 quick states). After navigation changes, a 618-state matrix isolated 12 custom-date clipping failures. Further stress checks reproduced large-amount clipping, guide/restore/negative-confirmation height issues and unreachable paper edges before their respective corrections.

Final results are recorded in `docs/verification-status.md`. The matrix covers 320, 360, 390, 412, 568×320, 768, 1023, 1024, 1280 and 1536px; English, Malayalam and Arabic; light/dark themes. Large-amount/long-name checks modify synthetic rendered text only and do not claim financial calculation verification. Existing financial unit tests remain a separate gate.

Screenshots and JSON reports are generated under ignored `test_artifacts/`. CI includes the new layout gate. Independent code review found no critical or important regressions.

## Platform and delivery boundaries

A browser viewport matrix proves shared layout behavior, not physical-device acceptance or Windows/macOS/iOS runtime compatibility. Existing Android APKs and published releases do not change when source files change. A newly signed APK and a higher-version release are needed before existing Android installations receive this correction. This task does not publish a live update or alter signing identity.
