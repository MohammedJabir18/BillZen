# Next task — package and verify the responsive correction

Read AGENTS.md, brain/sessions.md, brain/architecture.md, docs/verification-status.md and docs/responsive-layout-audit.md first. The latest owner request is a complete responsiveness correction, especially navigation. Preserve the existing financial behavior and Today-default dashboard. Do not start C2 features while this delivery remains unfinished.

## Implemented source behavior

- Below 1024px: Dashboard, Cashbook, Reports and More; the remaining four destinations live in a bounded sheet.
- Desktop: separate seven-destination navigation row below brand/language controls.
- Sheet: keyboard focus trap/restore, Escape and Android-back dismissal, safe-area spacing, resize cleanup.
- Narrow Dashboard dates, large amounts, long account names, guide/restore/cashbook dialog heights and reachable A4 preview edges corrected.
- Browser and Android verification helpers navigate through the visible More menu. The CI layout gate checks all seven sections in three languages and both themes.

Use the actual verification results in docs/verification-status.md. Do not turn a browser viewport pass into a claim of Android, Windows, macOS or iOS native acceptance.

## Delivery steps

1. Check the working tree, current branch, local commits and remote status. Preserve owner changes. If push authentication is unavailable, report that exact blocker; never extract integration credentials from another process or place secrets in command output.
2. Re-run relevant verification after further edits: npm test, npm run test:layout, npm run test:responsive, npm run test:dashboard, npm run test:theme, update screen and cashbook PDF suites.
3. For an Android distribution, prepare a strictly higher versionCode than the installation being updated. Keep all version sources aligned. Existing 0.1.2/code1007 APKs were built before the responsive correction and must not be described as containing it.
4. Build with the original Android certificate and the production manifest public-key pin. Use existing secure signing configuration; do not print keystore passwords, replace signing identity, enable production WebView debugging or ship an updater-disabled fallback.
5. Verify the new APK's certificate, versionCode, ABI/page-size alignment, hash and signed manifest. On an emulator/device, test native SQLite CRUD, More navigation/back behavior, portrait/landscape, text/input focus, theme, PDF/share flows and upgrade data preservation. Do not uninstall or clear the owner's app data.
6. Check the rebuilt Linux executable and any packaged installer separately. A loose executable is not an updater-ready signed AppImage.
7. Commit and push each verified logical section using configured owner authentication. Inspect the resulting CI state. Packaging and local tests do not authorize publishing a live update; retain a reviewable candidate/draft until release publication is explicitly requested.
