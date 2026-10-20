# Antigravity prompt — BillZen premium UI redesign

Copy everything below into Antigravity. This replaces the previous packaging-first handoff; the owner's current priority is a complete premium, responsive UI redesign. Packaging remains a final delivery step, not permission to publish a live release.

---

Act as a Principal Product Designer, Senior Frontend Engineer and Motion Designer. Redesign the complete existing BillZen application into a distinctive, premium business product with a professional, polished “WOW” first impression and smooth, purposeful motion. Build on the working application and its actual data flows.

This is an offline company cashbook, billing, inventory and reporting application used by nontechnical business owners in India and GCC countries. The most important task is recording money received and money paid, issuing receipts/payment vouchers, and understanding today's financial position. Premium aesthetics must make these daily tasks clearer and faster. Keep the interface approachable and trustworthy.

## 1. Restore project context and establish evidence

Read AGENTS.md, brain/sessions.md, brain/architecture.md, the curated brain/ graph notes, docs/verification-status.md and docs/responsive-layout-audit.md. Inspect the current Git status, branch, commits, package/lock files and running application. Protect existing owner changes.

Baseline checkpoint: c27c75b introduced the responsive correction. Inspect the current checkout rather than assuming this is still HEAD. At that checkpoint:
- Tauri 2 + React + Vite + TypeScript + Tailwind; Rust/SQLite business backend.
- Default home is Today dashboard, with Simple View and Detailed Analytics.
- Below 1024px: Dashboard, Cashbook, Reports and More. More contains Products, Customers, Settings and Print.
- Desktop: seven destinations below the brand/language header.
- English, Malayalam and Arabic/RTL; System/Light/Dark appearance settings live in Settings.
- Fresh results: 906 rendered layout states, 53 frontend unit tests, 34 onboarding checks, 104 theme checks, 25 dashboard assertions, 6 responsive viewports, 4 updater UI scenarios, 12 cashbook browser steps, 3 PDF scenarios and 39 Linux native assertions passed. These are historical baselines, not proof that your new work passes.
- Linux executable was rebuilt. Existing Android 0.1.2/code1007 APK predates those responsive fixes.
- GitHub push lacked configured CLI authentication. Check access without exposing credentials; preserve local commits if blocked.

Open the actual app in a browser and audit every destination, modal and important state. Record screenshots and defects before changing the design. Distinguish browser preview behavior from native SQLite behavior.

## 2. Discover and actually use my installed skills

Discover the installed skills/plugins available to this Antigravity session. Read their actual SKILL.md files and relevant references before invoking them. Local versions may differ from current upstream repositories. Use exact installed skill/command names; do not invent commands, silently reinstall packages or claim an unavailable tool was used.

Create docs/design/skill-usage.md with skill name, installed path/version when available, assigned phase, tangible output, and missing/incompatible capabilities. Use all available UI/design skills at the appropriate phase, while resolving overlapping advice into one coherent design system. Do not activate competing visual directions simultaneously.

Required skill responsibilities:

| Skill/plugin | Concrete responsibility |
| --- | --- |
| Superpowers / brainstorming | Restore context, understand daily receipt/payment tasks, compare design directions and establish a reviewable design before broad UI migration |
| Taste Skill / installed design-taste-frontend or its local predecessor | Art direction, composition, typography and app-screen visual quality; use its dashboard/app route where available |
| Anti-slop | Remove generic template choices, decorative clutter, fabricated metrics, filler copy and repetitive visual patterns; audit both prototype and final screens |
| UI UX Pro Max | Research appropriate finance/product patterns, palette/type pairing, responsive and accessibility recommendations; generate the design-system rationale using its actual installed workflow |
| UX/UI Agent Skills | Information hierarchy, component states, token consistency, forms, keyboard/touch behavior and accessibility review |
| Anthropic frontend-design | Translate the chosen direction into high-quality production React/CSS components that belong specifically to BillZen |
| Impeccable | Run the installed audit/critique workflow, then responsive adaptation, clarification, hardening, performance and final polish capabilities where available |
| Design Motion Principles | Define purposeful transitions and audit animation timing, interruption and consistency |
| Emil Kowalski skills | Refine interaction details, easing, form feedback, dialogs and perceived responsiveness using relevant installed guidance |
| Brand Guidelines | Protect BillZen's existing logo/icon and create consistent product branding; do not apply Anthropic's brand palette or identity to BillZen |
| Theme Factory | Explore coherent light/dark palette directions; convert the selected direction into semantic product tokens |
| Archify | Document navigation/state flows and the UI-to-business-layer boundary with a diagram grounded in the actual code |
| Karpathy Guidelines | Keep changes focused, readable and verifiable; avoid unnecessary abstraction or a framework rewrite |
| Harness Engineering | Maintain a component/state coverage matrix and honest verification evidence across sessions |
| Loop Engineering | Use bounded fix/verify cycles and stop conditions when available; no uncontrolled loops or automatic merges |
| Chrome DevTools / installed browser tooling | Inspect actual rendered screens, console errors, overflow, animation performance, input behavior and network requests |
| Modern Web Guidance | Validate current browser, responsive, accessibility and interaction practices |

If installed and compatible, use gstack for relevant browser/product QA and cc-thinking-skills for design tradeoffs. Use Claude Octopus only when its orchestration materially helps and is available; it must not become a requirement for this local frontend task. Use an installed security-audit skill where changes affect dependencies, CSP, external assets or exports. No unavailable cloud service, paid model provider or API key may become a runtime requirement. Report missing skills and proceed with supported equivalents unless an essential capability is genuinely blocked.

## 3. Research current references and stable implementation choices

Research the current official GSAP documentation, React integration and showcase:
- https://gsap.com/docs/v3/
- https://gsap.com/resources/React/
- https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
- https://gsap.com/showcase/

Use current Awwwards examples and the original live product/designer sites for visual references. Inspect at least 4–6 relevant examples, including real financial/data-heavy product interfaces and touch layouts. Record URL, date inspected, observed pattern, why it fits BillZen and how it will be adapted in docs/design/references.md. Label inspiration separately from implementation and measured performance. Do not call a reference “latest/trending” without dated evidence, or copy a site's branding/assets/layout wholesale.

Look for strong typography, disciplined whitespace, coherent surfaces, premium navigation, clear financial hierarchy and restrained motion. Translate expressive website craft into an efficient business application. Do not add scroll hijacking, cursor replacements, mandatory intro loaders, autoplay backgrounds, giant marketing hero sections or constant motion to transactional screens.

Keep the current stable stack. Verify current compatible stable versions before adding GSAP/@gsap/react; record the choice and bundle impact. Do not upgrade the framework, Rust stack or database merely to redesign the UI. Bundle fonts, icons and animation dependencies locally: the installed app must remain usable with no internet. Preserve CSP and avoid runtime CDN scripts, remote fonts or mandatory telemetry.

## 4. Design direction and concrete prototype

My desired result is a premium, contemporary financial workspace with a strong BillZen identity, excellent typography, clean composition and refined motion. Use the existing BillZen icon and its green/lime recognition as the starting point. Treat the following as a recommended direction to validate, not a previously approved visual design:

“Precision Ledger”: warm neutral light surfaces, deep neutral dark surfaces, a controlled BillZen green/lime accent, crisp typography, aligned tabular figures, quiet borders, considered depth and generous but efficient spacing. Use green/red meaningfully for receipt/payment; always include text/icons so color is not the only signal. Avoid neon overload, glass effects across every surface and generic gradient-card dashboards.

Prepare two genuinely different, clickable browser prototype directions using synthetic company data. For each show:
- Desktop and 360/390px mobile Today dashboard.
- Cashbook with populated transaction list and receipt/payment entry.
- At least one dark-mode view and one representative Arabic or Malayalam screen.
- Working navigation, date filter and a small motion sample.

One direction should explore Precision Ledger; the second should offer a credible alternative composition/type treatment. Recommend one and explain the practical tradeoff briefly. Label prototypes as prototypes; do not replace durable business data or claim placeholder actions work.

Present both visually before asking for one consolidated design choice. If an installed workflow requires approval, ask only after these concrete previews are ready. After the design is approved, continue through implementation, QA and handoff without requesting permission for every component. Create a documented design and phased implementation plan following the installed Superpowers workflow.

## 5. A complete design system and full-screen coverage

Create a BillZen design-system document and reusable semantic tokens for colors, typography, spacing, radii, borders, elevation, density, focus and motion. Pair Latin/Malayalam/Arabic fonts with sufficient glyph coverage and readable line heights; package fonts locally and verify their licenses. Keep monetary figures readable, aligned and fully visible, including negative and 3-decimal GCC amounts.

Build a small shared component layer appropriate to the existing repository: app shell, page heading, navigation item, button, amount display, metric panel, segmented filter, form field, search, date range, account selector, table/mobile transaction row, status badge, dialog/sheet, empty/error/loading state and toast. Reuse existing accessible primitives where present. Add dependencies only when justified; avoid an elaborate abstraction framework.

Redesign every existing user-facing section and its important states:
1. App shell, header, responsive navigation, More sheet, page transitions and status messaging.
2. Today dashboard: Money Received, Money Paid, Net Cash Change, Closing Balance, account balances, recent transactions and clearly separate Simple/Analytics views.
3. Cashbook: Receive Money and Pay Money prominent; account management, classification, category/party fields, filters, partial/failed submissions, reversal and negative-balance confirmation.
4. Reports: daily/monthly/yearly/custom periods, full date inputs, account/direction/category/payment filters, summary versus matching totals, CSV/PDF actions and populated/empty lists.
5. Products/inventory and customers/CRM: search, list/table and mobile rows, create/edit/archive dialogs and validation.
6. Settings: company/regional profile, System/Light/Dark appearance, backup/restore, guide replay and update controls. Keep appearance controls in Settings.
7. First-run setup and optional skippable guide.
8. Invoice/voucher/report preview, A4/80mm/58mm surfaces where supported, update notifications and all nested dialogs.

Preserve real data semantics. Cash inflow is not automatically revenue, outflow is not automatically expense, and net cash change is not accounting profit. Never invent sales growth, trends, balances or analytics merely to fill the design. Keep synthetic example data restricted to prototypes/tests. Do not remove an existing function or replace a working action with a decorative placeholder.

## 6. Motion specification

Use CSS transitions for simple hover/focus/pressed feedback and GSAP for deliberate coordinated transitions where it adds value. Avoid two animation engines controlling the same element. Do not introduce another motion library without explaining the need.

Document a motion matrix: interaction, purpose, target elements, duration, easing, reduced-motion behavior and cleanup. Initial design budgets, to validate on actual hardware:
- Hover/focus/pressed feedback: roughly 100–160ms.
- Menus, sheets, dialogs and filter-state changes: roughly 160–240ms.
- Page-level transitions: roughly 180–300ms, subtle opacity/short displacement.
- Optional first-view composition: under about 450ms total; never replay a stagger on every keystroke or query refresh.

Implement scoped useGSAP/context cleanup and contextSafe for event-triggered GSAP work as appropriate. Clean up listeners, matchMedia handlers and timelines on unmount; ensure React Strict Mode does not duplicate work. Use gsap.matchMedia for breakpoint and prefers-reduced-motion adaptations. Reduced-motion users must retain all content and actions, with nonessential movement removed. Respect live preference changes.

Prefer transform/opacity over layout-heavy properties. Avoid animating monetary digits during entry, permanent ticker/counter effects, flashing charts and animated financial text that conceals the actual value. Saving a receipt/payment must never wait for an animation. A success animation may acknowledge a confirmed save, not simulate completion before the backend succeeds.

Hover effects apply only to hover-capable devices; touch users need equally clear pressed/focus feedback. Charts and explanations must work by tap/keyboard as well as hover. Under print media, remove motion/animated hiding and preserve paper geometry and all totals.

## 7. Responsive, accessible and performant by construction

Design for 320, 360, 390, 412, 568×320 landscape, 768, 1023, 1024, 1280 and 1536px. Keep the proven mobile 3-primary-plus-More structure initially. Any approved alternative must preserve discoverability, keyboard/back handling and reachability without recreating seven cramped mobile tabs.

Requirements:
- Content-driven breakpoints, wrapping labels and bounded controls; no body-level horizontal clipping used to hide defects.
- Horizontal scrolling only in explicitly designed data tables or fixed-size paper previews, with every edge reachable.
- No navigation/header overlap, truncated required dates, lost amount digits or essential controls beneath fixed navigation.
- Safe areas, dynamic viewport height, phone landscape, software keyboard and browser zoom/text scaling handled deliberately.
- Modals remain within the viewport, with scroll access to all fields and confirmation buttons.
- Arabic RTL uses logical spacing/order where appropriate; mixed currency/date/numeric content has deliberate directionality. Test long Malayalam labels and large GCC amounts.
- Target WCAG 2.2 AA: at least 4.5:1 normal text, 3:1 large text and relevant UI boundaries, visible focus, semantic controls and descriptive labels. Aim for at least 44px touch targets for primary navigation/actions.
- Dialog focus management, Escape, Android Back, background scroll restoration and breakpoint cleanup stay correct.
- System theme is the default; switching themes preserves readable contrast in every surface, including hover, selection, error, disabled and validation states.
- No essential information appears only in an animation, tooltip, hover or color.
- Measure responsiveness and animation on available devices rather than promising universal 60fps. Record hardware, browser/WebView, viewport, data size and before/after results. Check dropped frames, long tasks, layout shifts, repeated listeners and bundle growth.

## 8. Implementation, automated QA and delivery

Work in coherent sections: audit/reference research; reviewed prototype/design system; shell/components; Dashboard/Cashbook; remaining screens; motion/accessibility; regression/packaging handoff. Use the repository's actual branch policy and preserve current work. Update brain memory and the component/state coverage matrix as each section is completed.

Use the browser yourself for testing; do not delegate ordinary UI verification to me. Test synthetic populated data, empty/loading/error states, long names, maximum supported amounts, search/filter changes, form validation, duplicate clicks, nested dialogs, keyboard navigation, touch interaction and reduced motion. Inspect screenshots visually; a zero-overflow measurement alone does not prove the design is usable.

Run the relevant current scripts and investigate failures rather than weakening assertions:
- npm test; npm run build
- npm run test:layout; npm run test:responsive
- npm run test:dashboard; npm run test:cashbook; npm run test:catalog
- npm run test:onboarding; npm run test:theme
- node scripts/verify_updates_browser.js
- npm run test:cashbook-pdf; npm run test:matrix
- npm run test:native-cashbook after rebuilding Linux
- Android runtime/update suites after preparing a suitable test build/device.

Retain stable test IDs when possible. If intentional navigation or UI changes require test updates, preserve equivalent behavioral coverage and prove failures were caused by obsolete assumptions rather than a product defect. Add regression checks for new important interactions. Use targeted TDD/systematic debugging for behavior changes and independent review where the installed workflow calls for it.

Do not change financial calculations, SQL schema, transaction atomicity, voucher numbering, idempotency, backup semantics, signing identity or updater trust boundaries to accomplish a visual redesign. If a real functional defect is discovered, document it and make a separately verified correction. Preserve A4/thermal print layouts; screen styling must not leak into printable documents.

For every completed logical section: inspect the diff, run relevant checks, stage only intended files, commit descriptively, push using existing configured authentication, verify the remote commit and report actual CI status. Never force-push, publish live releases automatically, bypass failing checks, extract credentials from another process or include business databases/signing secrets/generated artifacts in Git. If push authentication fails, retain the local commit, report the blocker and continue independent design work.

Update docs/verification-status.md and the session/architecture notes with actual results and platform limitations. Run the mandatory Graphify sync; if semantic extraction is unavailable, report that and use the supported local code-only fallback without claiming a full semantic refresh.

Rebuild Linux when the redesign is verified. For an Android candidate, use a strictly higher versionCode than installed builds, the original certificate and the production manifest pin. Verify signature, metadata, hash, page alignment and upgrade data preservation on an emulator/device. No uninstall/data clearing of the owner's installation. Browser checks are not Android/iOS/Windows/macOS native acceptance. Keep new distribution artifacts distinguishable from old ones and retain a reviewable candidate/draft until publication is requested.

## 9. Required outputs and completion criteria

Deliver:
- Audit with before screenshots and a complete screen/state coverage matrix.
- Verified installed-skill usage report and dated reference board with sources.
- Two clickable design directions, a recommendation, and the selected design rationale.
- BillZen design tokens/component guidelines and a motion/accessibility specification.
- Fully implemented approved UI across all existing sections, both themes and supported languages.
- Before/after screenshots at mobile/tablet/desktop sizes and a short genuine recording of the working UI when tooling permits.
- Automated QA evidence, visual review findings, performance/bundle comparison and honest native-platform coverage.
- Updated technical docs, brain memory, commit IDs, push/CI status and unambiguous artifact paths/version metadata.

Success means a cohesive premium BillZen experience that a nontechnical business owner can use quickly: receive money, pay money, find a transaction and read today's balance without confusion. It must remain offline, responsive, accessible and reliable. Do not claim an Awwwards award or universal platform support from visual quality alone.

Start now by restoring context, discovering the installed skills, auditing the real application, researching references and producing the two concrete browser prototype directions. Do not respond with only a generic redesign plan or a list of skill names.

---

## Research references for this prompt (checked 2026-10-20)

These are upstream references, not proof that a particular version is installed in Antigravity. Read the installed skill first.

- [Anti-slop](https://github.com/miqdadbadjuber/anti-slop)
- [Taste Skill](https://github.com/Leonxlnx/taste-skill)
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- [UX/UI Agent Skills](https://github.com/plugin87/ux-ui-agent-skills)
- [Impeccable](https://github.com/pbakaus/impeccable)
- [Design Motion Principles](https://github.com/kylezantos/design-motion-principles)
- [Emil Kowalski skills](https://github.com/emilkowalski/skills)
- [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- [Anthropic brand-guidelines](https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md)
- [Anthropic theme-factory](https://github.com/anthropics/skills/blob/main/skills/theme-factory/SKILL.md)
- [GSAP docs](https://gsap.com/docs/v3/), [React integration](https://gsap.com/resources/React/), [matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/), [Showcase](https://gsap.com/showcase/)
