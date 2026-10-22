# Hermes coding prompt — BillZen reference motion, unchanged design

You are working in `/home/jabir/Coding/My Projects/BillZen` as a senior React/Tauri design engineer. Implement the motion language of my supplied video in the existing BillZen app. This is an animation/interaction pass, not a redesign. Preserve current colors, layout, navigation destinations, typography, dimensions, information hierarchy, branding, content and financial behavior.

Local video:
`/home/jabir/Downloads/AQMqL1xoTZZ85yYeOt8R35J4S5ZQK52MjrFBncs2WNOByum5GJas4fvpX_GVexPEBOHrQTyIHNB03VFxx6IG1D79Dcfb2b4Vp3KDnlM.mp4`

The video is720×1280 and approximately6.29seconds. Read `docs/research/hermes-motion-skills.md` for the inspected timeline, sources, observations and uncertainty. If this exact attachment is unavailable in your environment, state that and obtain it rather than claim to have watched it. The screenshot showing enabled MCPs is an inventory hint, not proof their tools work and not a design reference.

## Restore context and discover capabilities

1. Follow current `AGENTS.md`, `.agents/rules/brain-workflow.md`, `brain/sessions.md` and `brain/architecture.md`; inspect current graph/motion dependencies and git status without resetting user changes.
2. Read approved `docs/design/design-system.md`, `docs/design/skill-usage.md` and the local-skills add-on. Preserve actual current Precision Ledger tokens. Older design palettes must not override the owner's explicit no-color/no-structure-change instruction.
3. Discover installed Hermes skill IDs and their actual SKILL.md files, versions and tools. Honor scope/compatibility rather than assuming every Claude plugin or command is Hermes-native. Build a concise skill-to-task/evidence matrix.
4. Use the following installed global collections with distinct roles:
   - **obra/superpowers:** plan, focused implementation, regression tests, debugging and evidence before completion.
   - **cobusgreyling/loop-engineering:** scope/budget constraints and bounded verify/fix cycles. No unattended scheduler or auto-merge.
   - **multica-ai/andrej-karpathy-skills:** surgical edits, explicit assumptions, no speculative abstractions/dependency churn.
   - **ayghri/i-have-adhd:** concise actionable Malayalam status updates and one clear next step; no fabricated estimates.
   - **nyldn/claude-octopus:** an optional independent review only if its actual Hermes integration/provider works. Do not invent `/octo:*` availability or launch a second orchestrator.
   - **walkinglabs/learn-harness-engineering:** reuse the existing brain, verification scripts and resumable evidence; keep the harness small.
   - **tt-a1i/archify:** a compact motion lifecycle/ownership diagram when useful; not a dashboard redesign.
   - **witt3rd/oh-my-hermes:** use an available Hermes-native planning/execution skill as the single coordinator, with independent review if supported. Avoid nesting OMH autopilot, Octopus and another loop.
   - **mvanhorn/last30days-skill:** bounded recent research only if it resolves a real uncertainty; trends cannot override the reference, official docs or app usability.
   - **Panniantong/agent-reach:** fetch primary docs/repos through available read-only backends; report unavailable channels honestly.
5. Read and apply the separate `hermes-billzen-local-skills-addon.md`. A reviewed but incompatible/out-of-scope skill must be recorded as such, not falsely claimed as used.

## Reference motion to reproduce

The main distinctive effect is a moving elastic navigation capsule. The visible example code uses a full-size layer clipped to the target item; its leading edge moves first, with the trailing edge catching up. Readable example values are0.36s/`power3.out` and0.55s/`power3.inOut`. These are reference-code parameters, not frame-measured timings. Match the feel, adapting if necessary for this fast financial interface.

- Keep BillZen's existing selected/hover colors. Do not copy the video's black/blue ERP styling, orange title, floating rail or code panel.
- Move the decorative pill between actual button bounds with a bounded stretch/catch-up; no excessive spring/bounce. Navigation content and action handling update immediately, independent of decorative completion.
- Keep `aria-current` tied to the actually selected view. Pointer hover/focus previews must not select a page or falsely change its semantic state. If preview is added, preserve an unmistakable selected state and return correctly on leave/blur.
- Correctly measure unequal English/Malayalam/Arabic labels, loaded fonts, RTL, zoom, resizes and responsive navigation modes. No hardcoded positions, label widths or left-only RTL logic. Decorations cannot intercept clicks or clip focus outlines.
- Add restrained feedback to existing clickable cards/buttons and coherent entry/exit to existing panels/dialogs only where helpful. Proposed starting budgets: hover120–150ms, panel200–240ms, modal220–260ms. Preserve existing press scale around0.975. These are BillZen adaptations, not claims of exact video measurements.
- Existing genuine charts may reveal their real paths/bars once when meaningful. Do not add chart libraries, fabricated chart data, animated fake balances, digit counters or placeholders pretending to be financial results. Render authoritative amounts immediately and exactly.
- Do not add Manufacturing/Stock/Warehouse pages from the clip. Do not animate the video's presentation surround or final ghost/dissolve frame. Keep language/theme controls in Settings; the reference's header switch does not authorize relocating them.

## Engineering boundaries

Inspect existing `src/components/AppNavigation.tsx`, `App.tsx`, Dashboard/Cashbook/Reports, dialog components, `src/styles/globals.css` and their tests. `gsap` and `@gsap/react` already exist; use scoped `useGSAP`/context-safe handlers and CSS rather than adding competing animation libraries.

Prefer opacity/transforms for ordinary transitions. Clip-path/geometry work for the small navigation decoration is acceptable if bounded and profiled. Never animate an entire table's layout on every hover/keystroke, create a global MutationObserver/ticker, or replay all entry animations after each query refetch. Avoid fighting CSS and GSAP over the same transform; assign ownership explicitly.

Handle React Strict Mode, interrupted rapid hover/click sequences and unmounts. Kill/revert only owned tweens; remove listeners/observers and settle transforms/opacity. Re-measure through a scoped ResizeObserver/fonts readiness as needed; do not do synchronous document-wide layout reads on pointermove. DOM refs and cleanup must remain type-safe.

Respect `(prefers-reduced-motion: reduce)` in JavaScript and CSS; the current CSS duration rule alone cannot stop GSAP. Reduced-motion mode must immediately show the real final state, retain focus/selection and suppress movement. Match `(hover: hover) and (pointer: fine)` before hover-only effects. Touch has press/focus feedback without stuck hover or hidden actions. Do not block Android Back/Escape/focus return while animating dialogs.

Preserve native scrolling,44px touch targets, no horizontal overflow, contrast and input responsiveness. No scroll hijacking, magnetic cursors, parallax, perpetual shimmer,3D tilt, page-wide blur or decorative loops. Motion should remain optional polish if JS effects fail; no content left invisible waiting for an animation.

Keep financial/domain/adapters/SQLite/idempotency/negative-balance confirmation/backup/updater/signing logic unchanged. No cloud dependency, remote fonts, CDN scripts or external runtime telemetry. Do not access business records to create demos. Do not reintroduce the removed Print Probe, framework badges or header language selector.

Print/PDF must be independent of motion: invoice/voucher/report targets show final, opaque, untransformed content. Pending enter/exit timelines must not leak into A4/80mm/58mm output. Do not globally kill application animation state in a way that breaks the UI after printing. Test screen-to-print-to-screen restoration.

## Work in coherent phases

A. Inventory current motion/skills and capture before screenshots of the real existing UI in isolated synthetic contexts. Write a short motion plan, ownership/budget matrix and acceptance checks. The user's design constraint is already clear; ask only genuinely blocking questions.

B. Implement and verify the navigation capsule first, including interruption/RTL/reduced-motion/touch. Inspect the actual browser interaction and record a short clip, not just static screenshots.

C. Apply consistent motion to existing panels, interactive controls and dialogs with the relevant project-local motion/design skills. Keep the scope small; a short shared hook/token file is fine if it removes real duplication, not a new generic motion framework.

D. Verify the final implementation independently. Load the current package scripts rather than assuming historical counts. Run appropriate unit/build/browser gates and targeted native checks. Record failures and actual reruns, not only successful screenshots.

E. Inspect diff; document actual changes and limits in the brain/verification notes. Follow the repository's authorized logical-section commit/push workflow, verify remote commit and CI state separately. Do not publish new installers/releases, overwrite signing identity, force-push or reset user work just to complete a motion pass.

## Acceptance and evidence

- Before/after settled screenshots preserve layout geometry, colors, typography and existing controls across light/dark and EN/ML/AR. Test at least320,390,768,1024,1280px plus existing broader layout coverage as warranted.
- Exercise fast pointer changes, click before a tween finishes, repeated navigation, focus/keyboard, font loading, resize, zoom, RTL, mobile More menu and touch/coarse-pointer behavior. No selection desync, click-blocking overlay or duplicate event handlers.
- Toggle reduced motion before and during interactions. Verify final visibility/bounds and absence of ongoing movement over time; one screenshot is insufficient proof that animation stopped.
- Existing receipts/payments/negative confirmation/reversal, filters, settings persistence, onboarding and backups continue working with synthetic data. Exact money values/precision and real backend state are unchanged.
- Preserve PDF isolation and page geometry; test A4 and existing thermal formats, dark mode, reduced motion and print during a transition. Existing scripts include unit/build, header/navigation, layout/theme, Cashbook UI/PDF, Reports UI, onboarding, matrix and native Cashbook checks; use actual current names/requirements.
- Inspect browser performance/paint/layout activity. Aim for smooth interaction on modest devices; no unsupported universal60fps claim. Report device/browser, observed traces or frame evidence, bundle impact and untested native targets.
- Browser Chrome evidence is not proof of Linux WebKitGTK, Windows WebView2 or Android native behavior. Run what the environment supports; distinguish tested, simulated and not run. Do not invent signing credentials, data resets or new keys for a native check.

Required output: concise skill-use matrix with actual paths/statuses; motion plan; implementation summary; before/after images and short screen recording; measured acceptance/test results and limitations; updated brain/verification records; commit/remote/CI status. Keep user updates in Malayalam and code identifiers/docs clear. Finish with the result and one concrete next step, without claiming every installed skill ran.
