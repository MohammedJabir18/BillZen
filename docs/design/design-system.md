# BillZen Design System Specification: "Precision Ledger"

**Version:** 1.0.0  
**Status:** Approved by Owner (2026-10-20)  
**Direction:** Direction 1 — Precision Ledger  
**Primary Audience:** Retail shopkeepers, wholesalers, and SME owners in India and GCC countries  
**Stack Alignment:** Tauri 2, React 19, Tailwind CSS 3.4, Vite 8, GSAP 3.15  

---

## 1. Executive Summary & Design Philosophy

"Precision Ledger" is BillZen's approved design language. It is calibrated specifically for non-technical business operators who manage daily transactions, print vouchers, and verify cash balances.

### Core Tenets:
1. **Approachability & High Trust:** Warm, paper-inspired surfaces in light mode and deep forest surfaces in dark mode replace cold corporate grays. The interface feels established, trustworthy, and tangible.
2. **Uncompromising Financial Precision:** Every monetary figure uses `tabular-nums` formatting to ensure absolute vertical decimal alignment. Currency amounts are never abbreviated with loss of precision, truncated without tooltip access, or rendered in floating-point representations.
3. **Restrained Identity Accent:** BillZen's signature green and lime identity is used strategically to guide attention (such as the featured Closing Balance card and primary receipt actions) rather than overwhelming the eye with neon glare.
4. **Physical, Tactile Micro-Interactions:** Buttons and interactive elements compress subtly (`scale(0.975)`) on click or touch, giving physical feedback modeled on cash-drawer buttons.
5. **Universal Trilingual Ergonomics:** Layouts, fonts, and paddings natively accommodate English (LTR), Malayalam (complex ligatures and deep descenders), and Arabic (RTL typography with contextual shaping).

---

## 2. Semantic Color Architecture

The color system uses CSS custom properties defined at `:root` (light) and `body.dark` / `html.dark` (dark), mapping directly to Tailwind utility extensions.

### 2.1 Surface Tokens
| Token Name | CSS Variable | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `surface-canvas` | `--bg-canvas` | `#f8f9f6` (Warm Stone) | `#0c0f0d` (Deep Obsidian) | Full-screen app background |
| `surface-card` | `--bg-surface` | `#ffffff` (Pure White) | `#141915` (Forest Slate) | Primary cards, panels, table containers |
| `surface-muted` | `--bg-surface-subtle` | `#f2f4ef` (Tinted Neutral) | `#1e261f` (Raised Charcoal) | Table headers, segmented tab bars, inactive chips |
| `surface-overlay`| `--bg-overlay` | `rgba(16, 27, 24, 0.45)` | `rgba(0, 0, 0, 0.70)` | Drawer and modal backdrops |

### 2.2 Border Tokens
| Token Name | CSS Variable | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `border-subtle` | `--border-subtle` | `#e5e9df` | `#242c26` | Card dividers, table row lines, inactive tabs |
| `border-medium` | `--border-medium` | `#d6dcce` | `#333d35` | Form input borders, modal outlines |
| `border-focus` | `--border-focus` | `#1f3d23` | `#ceeaa0` | Focused input border, active tab outline |

### 2.3 Typography & Text Tokens
| Token Name | CSS Variable | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-primary` | `--text-main` | `#141915` | `#f0f3ee` | Headings, primary amounts, active labels |
| `text-secondary`| `--text-muted` | `#576356` | `#9eaba0` | Subtitles, table headers, helper notes |
| `text-subtle` | `--text-subtle` | `#788677` | `#6f7c71` | Timestamps, voucher metadata, disabled labels |
| `text-on-accent`| `--text-on-accent` | `#ffffff` | `#0c0f0d` | Text on brand green/lime buttons |

### 2.4 Brand & Financial Action Accents
| Purpose | Light Foreground / Border | Light Background | Dark Foreground / Border | Dark Background |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Brand** | `#1f3d23` (`--brand-primary`) | `#1f3d23` | `#2e5733` | `#2e5733` |
| **Brand Hover** | `#17301b` | `#17301b` | `#3b6d41` | `#3b6d41` |
| **Featured Closing Card** | `#142811` (Text) | `#ceeaa0` (Lime Surface) | `#ceeaa0` (Text) | `#1e3518` (Dark Forest) |
| **Inflow (Receipts)** | `#15803d` (Emerald) | `#eef8f0` (Subtle Mint) | `#22c55e` (Bright Emerald)| `#132a18` (Deep Mint) |
| **Outflow (Payments)**| `#b91c1c` (Crimson) | `#fef2f2` (Subtle Coral) | `#ef4444` (Bright Coral) | `#2d1414` (Deep Coral) |
| **Focus Ring** | `rgba(31, 61, 35, 0.4)` | — | `rgba(206, 234, 160, 0.5)`| — |

---

## 3. Typography System

### 3.1 Font Families & Offline Bundling
- **Font Stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Malayalam", "Noto Sans Arabic", sans-serif`
- **Offline Assets:** Bundled in `public/fonts/` with `@font-face` declarations in `src/styles/globals.css`. Zero external CDN or Google Fonts runtime dependencies.
- **Glyph Coverage:** Guaranteed full rendering for English (Latin), Malayalam (`ml`), and Arabic (`ar`).

### 3.2 Numerical Precision Invariant
- **Rule:** Every numeric amount, balance, count, and voucher ID must include `font-variant-numeric: tabular-nums` (Tailwind class: `tabular-nums`).
- **Rationale:** Prevents vertical table jitter when values update and guarantees decimal point alignment.

### 3.3 Typography Scale
| Role | Desktop Size | Mobile Size | Weight | Line Height |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Closing Balance** | 28px (`text-3xl`) | 24px (`text-2xl`) | 800 (Bold) | 1.15 |
| **Section Heading (H2)** | 20px (`text-xl`) | 18px (`text-lg`) | 700 (Bold) | 1.25 |
| **Card / Panel Heading (H3)**| 15px | 14px (`text-sm`) | 600 (Semibold) | 1.3 |
| **Body Regular** | 14px (`text-sm`) | 13px | 400 (Regular) | 1.5–1.6 |
| **Table Header / Label** | 11px (`text-xs`) | 11px | 600 (Semibold) | 1.4 |
| **Status Tag / Micro Badge** | 10px | 10px | 700 (Bold) | 1.2 |

---

## 4. Spacing, Geometry & Radii

### 4.1 Spacing Scale (4px Baseline Grid)
- `space-1`: 4px (micro gaps between icons and labels)
- `space-2`: 8px (padding inside chips, compact toolbar gaps)
- `space-3`: 12px (form input vertical padding, mobile card gap)
- `space-4`: 16px (standard panel padding, section margins)
- `space-6`: 24px (desktop card padding, section separators)
- `space-8`: 32px (page-level margins on widescreen)

### 4.2 Border Radii
- `--radius-xs`: 4px (micro tags, status chips)
- `--radius-sm`: 6px (form inputs, compact buttons)
- `--radius-md`: 10px (standard action buttons, cards, segmented controls)
- `--radius-lg`: 16px (major panels, dialog modals, bottom sheet drawers)
- `--radius-pill`: 9999px (pill buttons, fast-action switches)

### 4.3 Shadows & Depth
- **Rest Elevation:** `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)`
- **Hover / Active Elevation:** `box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04)`
- **Modal / Drawer Elevation:** `box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)`

---

## 5. The Eight Component States

Every interactive element (button, input, select, nav item, table row) must support all eight states:

1. **Default (Rest):** Clean, legible, accessible contrast meeting WCAG AA (>4.5:1).
2. **Hover:** Subtle background shift (+5% brightness/tint); suppressed on pure touch devices.
3. **Focus-Visible:** 2px solid focus ring with 2px offset. Never remove focus outlines without providing this replacement.
4. **Active (Pressed):** Physical tactile compression (`transform: scale(0.975)`) with immediate feedback.
5. **Disabled:** `opacity: 0.45; cursor: not-allowed; pointer-events: none;`.
6. **Loading:** Disabled state with subtle animated spinner or pulse; text remains in DOM for screen readers.
7. **Error / Invalid:** `aria-invalid="true"` with high-contrast red border (`#b91c1c` / `#ef4444`) and descriptive error message linked via `aria-describedby`.
8. **Selected / Active Navigation:** Distinct pill or border accent indicating the currently viewed screen or filter.

---

## 6. Motion System & Accessible Animation Rules

### 6.1 Purposeful Motion Contract
- Motion must be functional, not decorative. It communicates spatial origin, hierarchy shifts, and confirmation.
- **Zero Scroll Hijacking:** Standard native scrolling is strictly preserved on all views and tables.
- **Zero Distracting Loop Animations:** No infinitely bouncing icons or pulsating background gradients on financial screens.

### 6.2 Timing & Easing Curves
- **Micro-Interactions (Button press, hover):** 120ms–150ms `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Panel / View Switch Transition:** 200ms–240ms `power2.out` via scoped GSAP.
- **Drawer / Modal Entrance:** 220ms–260ms `power3.out`.

### 6.3 Reduced Motion Invariant
All animations must strictly respect the operator's accessibility settings:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. App Shell & Navigation Architecture (Phase UI-1)

### 7.1 Layout Shell Structure
- **Container:** `.app-shell-wrapper` constrained to max-width 1280px on widescreen desktop, centered with subtle outer borders. Full width edge-to-edge on mobile.
- **Safe Area Insets:** Top header and bottom navigation respect native Android/iOS system bars via `--sat` and `--sab` CSS environment variables.

### 7.2 Header Architecture (`AppHeader`)
- **Brand Identity:** Authentic BillZen lime/green vector mark (`/brand/billzen-icon.svg`), bold uppercase title `BILLZEN`, and subtitle `OFFLINE BUSINESS SUITE`.
- **Status Indicator:** Pill showing `Air-Gapped SQLite · Offline` with a living green status dot.
- **Language Switcher:** Accessible dropdown supporting English (`EN`), Malayalam (`ML`), and Arabic (`AR` with dynamic `dir="rtl"`).
- **Appearance Settings:** Note that appearance controls (System, Light, Dark) remain strictly confined to `SettingsView` per user rule.

### 7.3 Desktop Navigation (`DesktopNav`)
- Visible on `lg` screens (`>= 1024px`).
- Horizontal segmented pill bar with 7 destinations:
  1. `Dashboard` (Today's Position & Analytics)
  2. `Cashbook` (Ledger & Voucher Entry)
  3. `Reports` (Statements & CSV/PDF Export)
  4. `Products` (Catalog & Stock Ledger)
  5. `Customers` (Directory & Statutory Tax IDs)
  6. `Settings` (Profile, Theme, Backup/Restore)
  7. `Print Probe` (Hardware Feasibility Probe)

### 7.4 Mobile Bottom Navigation (`MobileBottomNav`)
- Visible on `< 1024px` screens.
- Fixed bottom bar with 4 primary destinations (3 primary + More):
  1. `Dashboard` (Today)
  2. `Cashbook`
  3. `Reports`
  4. `More` (Triggers accessible bottom drawer)
- Minimum tap target: 48px height across all mobile buttons.

### 7.5 Accessible More Sheet Drawer (`MoreNavigationDrawer`)
- Slide-over bottom drawer on mobile / modal sheet containing secondary destinations: `Products`, `Customers`, `Settings`, and `Print Probe`.
- **Accessibility Contract:**
  - `role="dialog" aria-modal="true" aria-label="More Destinations"`
  - Automatically moves focus to first item upon opening.
  - Traps `Tab` and `Shift+Tab` keyboard focus within the drawer.
  - Restores focus to the trigger button (`#mtab-more`) upon dismissal.
  - Locks body scrolling (`overflow: hidden`) while open.
  - Dismisses on `Escape` key press.
  - Dismisses on backdrop click.
  - Dismisses on native Android back button event (`billzen-back-button`).
  - Cleans up and dismisses automatically if viewport resizes to `>= 1024px`.
