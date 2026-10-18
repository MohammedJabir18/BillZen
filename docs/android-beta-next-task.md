# Antigravity task · Responsive Android beta

Build a standalone, installable Android beta of the existing BillZen project for a friend to test. Preserve the desktop application. Deliver working software and verification evidence, not just a plan or phone screenshots.

## Context and scope

Read AGENTS.md, brain/architecture.md, brain/sessions.md, docs/verification-status.md, docs/product-requirements.md and docs/brand/README.md. Inspect actual source before editing. Review commits e5848dc and 0df3bc9 and the latest remote CI status. Local checks passed during independent review; do not infer remote success.

The beta includes products, categories, customers, business settings and current language/currency support. M4 invoice/payment workflows are not implemented and are outside this task. Do not present fixture invoices as persisted business documents. Keep the existing lime Z identity, bundled fonts, financial contracts, migrations and desktop data location.

Use installed Superpowers brainstorming/planning, systematic-debugging, TDD and verification skills where applicable; Karpathy Guidelines for focused changes; Harness Engineering for checkpoints. For responsive design, use the installed UI/UX Pro Max or frontend-design skill as the primary guide, with Impeccable/anti-slop as a review pass if available. Use Archify if documenting changed runtime boundaries. Read applicable skill files and report unavailable skills accurately; do not invoke every installed plugin indiscriminately.

Write a brief implementation checklist and proceed through these sections. Ask only for genuinely required missing information or access; do not stop after producing a plan.

## A. Verify the baseline and migration acceptance gaps

Inspect the current migration and PDF corrections. Before claiming complete migration closure, add focused coverage for blank canonical descriptions, multiple case-variant duplicates, equal creation timestamps, repeat startup, failed-migration rollback and unknown V5 checksum rejection. Confirm unrelated product money/stock/movement data stays unchanged. Define deterministic description inheritance when several duplicates offer different values. Preserve audit data and valid historical checksum handling; never reset the database or bypass integrity checks.

## B. Configure an actual Android target

Check current official Tauri 2 Android prerequisites and the installed CLI. Configure compatible JDK, Android SDK/NDK, Rust targets and Gradle tooling, recording versions. Keep existing dependency lockfiles and avoid unrelated upgrades or prerelease dependencies.

Initialize the native Android project with the existing Tauri CLI. Keep an intentional, stable package identifier; do not casually rename the existing desktop identifier or break desktop updates. Configure emulator/device development networking only where needed. Production APK assets must be embedded and require no Vite server, laptop or internet to start.

Reuse generated BillZen Android icons. Commit appropriate native project/configuration sources; ignore local SDK paths, Gradle caches, build outputs, signing material and passwords. Check supported Android API/ABI and native-library compatibility against the selected stable toolchain.

## C. Make startup, storage and capabilities mobile-safe

Current lib.rs uses dirs::data_dir() with a working-directory fallback before Tauri setup. Resolve Android SQLite storage using Tauri's app-private path APIs when the app context is available. Preserve the existing desktop database directory; never silently move or abandon installed desktop data.

Retain one database worker and appropriate lock ownership for the application lifetime. Verify background/resume, process death/relaunch, rotation and upgrade installation. Handle startup errors meaningfully rather than assuming desktop process-exit behavior is appropriate on Android. Do not remove desktop single-instance protection without evidence.

Keep real Rust/SQLite access in the APK, not the browser mock. Verify mobile IPC window/capability mapping and least-privilege access. Avoid broad storage/network permissions or wildcard CSP changes. Gate CUPS/lp/lpr process probes and GTK-specific print notes by platform. Clearly report unsupported mobile print features rather than claiming window.print() provides working Android printing. Do not add camera permissions unless camera scanning is implemented and tested.

## D. Implement genuinely responsive screens

Support 320, 360, 390 and 412 CSS-pixel phone widths, portrait/landscape, a 768px tablet and existing desktop layouts. Inspect platform window configuration and ensure no desktop sizing assumption constrains Android; preserve the existing desktop minimum sizes. Do not assume desktop minWidth applies to Android without verifying actual runtime behavior.

- Replace the crowded single-row header with usable compact navigation, such as a bottom bar or accessible menu. Keep language switching reachable and report Android/browser/desktop environment accurately.
- Use readable catalog cards/list rows on phones with access to every existing field/action. Retain useful desktop tables. Do not conceal data or clip the page to fake responsiveness.
- Make add/edit forms keyboard-safe and scrollable, using full-screen sheets where suitable. Keep Save/Cancel accessible with the soft keyboard open. Handle validation, focus, unsaved changes and Android Back behavior.
- Use touch targets around 48 CSS pixels, accessible labels, visible focus, readable type, safe-area insets and appropriate input keyboards. Preserve leading-zero barcodes and exact financial parsing.
- Verify English, Malayalam and Arabic RTL with long names, empty/loading/error states and two-/three-decimal currencies.
- No document-wide horizontal overflow, overlapping controls or off-screen primary actions. Permit intentional local scrolling only where it improves a genuinely wide table.

## E. Test automatically through both browser and Android

Run existing frontend/Rust/build/catalog/PDF/native-probe checks. Add meaningful responsive browser scenarios for navigation, product/customer forms and RTL across the required widths; retain screenshots and inspect them. Do not equate browser mock screenshots with native persistence.

Install and launch the APK on an emulator or accessible device. Exercise native product/customer CRUD, archive/restore, category creation/selection and case-insensitive duplicate rejection, leading-zero barcode entry, quantities, settings and supported currency handling. Test cold launch and CRUD in airplane mode, force-stop/relaunch persistence, background/resume, rotation, software keyboard, Back navigation and update installation without data clearing. Test native command access and absence of fatal startup errors. Do not test upgrades by uninstalling the app, since uninstall removes its data.

Automate feasible testing yourself. Report emulator, physical-device, browser and hardware-print evidence separately. If a real phone or emulator cannot be accessed, state that limitation and retain feasible build evidence; never claim a native run happened.

## F. Deliver a shareable APK and GitHub checkpoints

Prefer a signed release beta APK. If secure release signing is unavailable, provide a clearly labeled signed debug TEST APK with embedded frontend assets and document its signing/update limitations. Never give the friend an unsigned APK, an AAB, or a development build requiring a running computer. Verify ABI/API compatibility; produce a suitable universal APK or label an arm64-only build clearly.

Keep signing keys/passwords out of Git, prompts and logs, and retain the signing identity securely for future updates. Do not change repository visibility or publish to Play Store without separate authorization.

For every completed logical section: inspect the diff, run relevant checks, commit intended files, push normally using configured authentication, verify remote SHA and inspect CI. Never force-push or print credentials. If authentication is unavailable, preserve the commit and report the exact blocked step; do not repeatedly hang on interactive credential prompts or claim a successful push.

Update README, verification status, platform support and session notes with actual evidence. Final delivery must include the APK's absolute path, version/package ID, minimum supported Android version, ABIs, signing type, SHA-256, tested emulator/device details, screenshots, install/update instructions, CI state and remaining limitations. Do not claim complete billing or Android release readiness beyond the evidence.
