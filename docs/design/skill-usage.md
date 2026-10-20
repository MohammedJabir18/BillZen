# BillZen Premium UI Redesign — Installed Skill Usage & Governance

This document records the installed design skills discovered in the Antigravity environment, their authoritative local paths, assigned development phases, concrete deliverables, and resolution of overlapping design guidelines into one unified design system for BillZen.

---

## 1. Discovered Skills Matrix

| Skill / Plugin | Installed Path / Discovery | Assigned Phase | Tangible Deliverable / Output | Status & Compatibility |
| :--- | :--- | :--- | :--- | :--- |
| **Superpowers / brainstorming** | `/home/jabir/.gemini/config/plugins/superpowers/skills/brainstorming/SKILL.md` | Phase 1 (Foundation & Direction) | User intent exploration, 2 clickable prototype briefs, architectural requirements | Installed & Active |
| **Taste Skill (v2)** | `/home/jabir/.gemini/config/skills/taste-skill/SKILL.md` | Phase 1 & 2 (Art Direction & Prototypes) | Evaluated 247 gallery sites, dealt `product-performs` and `quiet-instrument` directions, strictly banned empty card ornaments, mandated working interactive fragments | Installed & Active (`scripts/draw.mjs` verified) |
| **Design Doctrine (UX/UI Agent)** | `/home/jabir/.gemini/config/skills/design-doctrine/SKILL.md` | All Phases (Core Quality Gate) | Zero-emoji rule, 8 interactive component states, "one thing leads" visual hierarchy, token by intent | Installed & Active |
| **Anti-slop & Anti-slop UI** | `/home/jabir/.gemini/config/skills/antislop/SKILL.md`<br>`/home/jabir/.gemini/config/skills/antislop-ui/SKILL.md` | Phase 2 (Audit & Filtering) | Ban generic purple/blue gradients, glow overload, single-side colored borders, and fake metrics | Installed & Active |
| **Anti-slop Human & Layout** | `/home/jabir/.gemini/config/skills/antislop-human/SKILL.md`<br>`/home/jabir/.gemini/config/skills/antislop-layoutmobile/SKILL.md` | Phase 4 & 5 (Responsive & A11y) | WCAG 2.2 AA contrast verification, 44px touch targets, mobile-first reflow, zero horizontal scroll | Installed & Active |
| **UI UX Pro Max** | `/home/jabir/.gemini/config/skills/ui-ux-pro-max/SKILL.md` | Phase 1 & 3 (Research & Specs) | Financial & Invoice domain search, GSAP micro-interaction patterns, typography scales | Installed & Active (`search.py` verified) |
| **Impeccable (v4.6.0)** | `/home/jabir/.gemini/config/skills/impeccable/SKILL.md` | Phase 2 & 5 (Audit & Hardening) | "Operate" mode execution, screen-by-screen critique, edge cases, error states | Installed & Active |
| **Design Motion Principles** | `/home/jabir/.gemini/config/skills/design-motion-principles/SKILL.md` | Phase 3 (Motion Architecture) | Context-weighted motion (Emil Kowalski + Jakub Krehel restraint), motion budget matrix | Installed & Active |
| **Emil Kowalski Design Eng** | `/home/jabir/.gemini/config/skills/emil-design-eng/SKILL.md` | Phase 3 & 4 (Micro-interactions) | Tactile active scale (`0.97`), custom cubic bezier easing, interruptible popovers, perceived speed | Installed & Active |
| **Animate (Web)** | `/home/jabir/.gemini/config/skills/animate/SKILL.md` | Phase 3 (Transitions) | CSS transitions for high-frequency states + GSAP for coordinated page/drawer transitions | Installed & Active |
| **Frontend Design** | `/home/jabir/.gemini/config/skills/frontend-design/SKILL.md` | Phase 4 (Component Implementation) | Intentional typography, bespoke surfaces, distinctive character avoiding generic SaaS presets | Installed & Active |
| **Theme Factory** | `/home/jabir/.gemini/config/skills/theme-factory/SKILL.md` | Phase 3 (Tokens & Colors) | Systematic semantic light/dark tokens with high-contrast surfaces | Installed & Active |
| **Brand Guidelines** | `/home/jabir/.gemini/config/skills/brand-guidelines/SKILL.md` | Phase 1 (Brand Protection) | Protect BillZen's emerald/lime identity and mark; reject third-party corporate styling | Installed & Active |
| **Archify** | `/home/jabir/.gemini/config/plugins/archify/` | Phase 1 & 4 (Data Flow & Arch) | UI-to-business-layer state and navigation flow diagram | Installed & Active |
| **Karpathy Guidelines** | `/home/jabir/.gemini/config/plugins/andrej-karpathy-skills/skills/karpathy-guidelines/SKILL.md` | All Phases (Code Hygiene) | Surgical, minimal, readable code changes; no unnecessary abstractions or framework rewrites | Installed & Active |
| **Chrome DevTools / Playwright** | `/home/jabir/.gemini/config/plugins/chrome-devtools-plugin/` & native Playwright | Phase 2, 4, 5 (Verification) | Rendered DOM inspection, contrast checks, 10-viewport responsive matrix, screenshot goldens | Installed & Active |

---

## 2. Resolving Overlapping Guidance & Unified System Rules

To prevent conflicting visual directions from competing during development, the following hierarchy is established:

1. **Non-Negotiable Quality Floor (`design-doctrine` + `antislop`)**:
   - **Zero Emoji**: No emoji anywhere in UI, code, icons, or labels. Lucide SVG icons with `currentColor` only.
   - **No One-Sided Colored Borders**: Ban `border-l-4` / `border-l-indigo-500` callout cards. Use full hairline borders (`1px solid rgba(...)`) with subtle surface tinting.
   - **One Thing Leads**: In every screen or card grouping, establish unambiguous visual hierarchy. In the Today dashboard, the Net Cash Position / Closing Balance is the primary anchor.
   - **Eight States**: Interactive controls must provide distinct Default, Hover, Focus (accessible focus-visible ring), Active (pressed scale 0.97), Disabled, Loading, Error, and Selected states.
2. **Motion Governance (`design-motion-principles` + `emil-design-eng`)**:
   - **Emil Kowalski restraint**: High-frequency actions (keystrokes, voucher inputs, table row scans) must have **zero** lag and never wait for animations.
   - **Budget**: Hover/pressed feedback (100–160ms), Sheets/Drawers (180–240ms), Page transitions (200–280ms).
   - **Clean Scoping**: GSAP animations scoped with cleanup; `gsap.matchMedia()` handles `(prefers-reduced-motion: reduce)` by immediately jumping to final resting states.
3. **Domain Integrity (`Karpathy` + Project Financial Model)**:
   - Cash movement is liquidity, never accounting profit.
   - 100% offline functionality: Zero external CDN font or script dependencies.

## 2026-10-20 — UI-3 continuation evidence

See [Cashbook UI-3](cashbook-ui3.md) for the specific local guidance actually used, before/after review, behavioral gates and compatibility rulings. This continuation uses the existing approved design; it does not claim to have re-run every tool in the historical discovery matrix above. In particular, the installed Taste Skill v2 excludes app/dashboard screens, and no full Impeccable critique/detector command was run for UI-3. Its adapt/harden references were used directly.
