# UI-4 — Reports, Settings language and Android candidate

Continue the approved Precision Ledger design inline using executing-plans. The owner requests language controls only in Settings, removal of platform/framework labels everywhere in the app, Reports migration and a refreshed Android APK.

1. Add browser regressions for a clean header, Settings-only language changes persisting across reload and RTL, and populated Reports category/filter/export behavior. Observe baseline failures.
2. Move the existing language preference into Settings using the shared App state, retain initial setup language selection, remove platform badge and diagnostic footer from all shells. Update affected browser harnesses to use Settings.
3. Migrate Reports semantic surfaces, featured closing balance, usable date/filter controls, named fields, localized screen copy, honest loading/error/export guards and narrow populated layouts. Preserve period/statement/filter financial semantics and printed document contracts. Correct category ID/name mapping if reproduced.
4. Run units, relevant workflow/PDF tests, full layout/contrast and independent final review. Rebuild Linux, verify native against isolated data, update brain/docs, Graphify and owner-authorized main commit/push with actual CI status.
5. Prepare a higher-version same-certificate updater-enabled Android candidate using existing signing configuration only. Never expose passwords, replace the signing identity, clear owner data or publish a live release implicitly. Verify APK metadata/signature/alignment, hashes and available Android runtime. If signing access is unavailable, complete all other work and report precisely what is missing.

Rulings: use current main per explicit AGENTS delivery policy and clean starting tree. Existing approved design and direct user instructions settle design choices; no new design approval loop or dependency upgrade. Device-local language remains separate from business financial locale/currency. No cloud data synchronization added.
