# BillZen Application Baseline UI/UX Audit & Empirical Findings

**Date:** 2026-10-20  
**Audit Tooling:** Playwright automated browser audit (`scripts/audit_application_baseline.js`), headless Google Chrome, verified DOM selectors.  
**Baseline Commit:** `c27c75b` (Responsive application audit & correction).  
**Empirical Evidence:** `test_artifacts/audit/audit_manifest.json` — exactly 24 captured screen states across desktop, tablet, and mobile viewports.

---

## 1. Verified Evidence Manifest (24 Baseline Screens)

| ID | Destination / Screen | Specific Component State | Viewport | Theme | Language | Verified Artifact Path |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | Onboarding | Setup Wizard Initial Gate (Step 1) | 1280×800 | Light | English | `test_artifacts/audit/01_desktop_onboarding_wizard.png` |
| **02** | Onboarding | Getting Started Guide Dialog | 1280×800 | Light | English | `test_artifacts/audit/02_desktop_getting_started_guide.png` |
| **03** | Dashboard | Simple View (Today's Position) | 1280×800 | Light | English | `test_artifacts/audit/03_desktop_dashboard_simple_light.png` |
| **04** | Dashboard | Analytics View (SVG Inflow/Outflow Multi-bar) | 1280×800 | Light | English | `test_artifacts/audit/04_desktop_dashboard_analytics_light.png` |
| **05** | Cashbook | Transaction Ledger Table | 1280×800 | Light | English | `test_artifacts/audit/05_desktop_cashbook_light.png` |
| **06** | Cashbook | Receive Money Entry Dialog | 1280×800 | Light | English | `test_artifacts/audit/06_desktop_cashbook_receive_modal.png` |
| **07** | Cashbook | Pay Money Entry Dialog | 1280×800 | Light | English | `test_artifacts/audit/07_desktop_cashbook_pay_modal.png` |
| **08** | Reports | Reporting & Period Breakdown | 1280×800 | Light | English | `test_artifacts/audit/08_desktop_reports_light.png` |
| **09** | Products | Product Catalog & Inventory | 1280×800 | Light | English | `test_artifacts/audit/09_desktop_products_catalog.png` |
| **10** | Customers | Customer Catalog & Debtors | 1280×800 | Light | English | `test_artifacts/audit/10_desktop_customers_catalog.png` |
| **11** | Settings | Business Profile & Appearance Settings | 1280×800 | Light | English | `test_artifacts/audit/11_desktop_settings_light.png` |
| **12** | Settings | Settings in Dark Mode | 1280×800 | Dark | English | `test_artifacts/audit/12_desktop_settings_dark.png` |
| **13** | Dashboard | Today Dashboard in Dark Mode | 1280×800 | Dark | English | `test_artifacts/audit/13_desktop_dashboard_dark.png` |
| **14** | Cashbook | Cashbook Ledger in Dark Mode | 1280×800 | Dark | English | `test_artifacts/audit/14_desktop_cashbook_dark.png` |
| **15** | Reports | Reports Screen in Dark Mode | 1280×800 | Dark | English | `test_artifacts/audit/15_desktop_reports_dark.png` |
| **16** | Dashboard | Arabic RTL Dashboard in Dark Mode | 1280×800 | Dark | Arabic | `test_artifacts/audit/16_desktop_dashboard_arabic_rtl_dark.png` |
| **17** | Dashboard | Malayalam Dashboard in Dark Mode | 1280×800 | Dark | Malayalam | `test_artifacts/audit/17_desktop_dashboard_malayalam_dark.png` |
| **18** | Dashboard | Mobile Dashboard Simple View | 390×844 | Light | English | `test_artifacts/audit/18_mobile_dashboard_light.png` |
| **19** | Dashboard | Mobile Dashboard Analytics View | 390×844 | Light | English | `test_artifacts/audit/19_mobile_dashboard_analytics_light.png` |
| **20** | Cashbook | Mobile Cashbook Ledger View | 390×844 | Light | English | `test_artifacts/audit/20_mobile_cashbook_light.png` |
| **21** | Cashbook | Mobile Receive Money Entry Modal | 390×844 | Light | English | `test_artifacts/audit/21_mobile_cashbook_receive_modal.png` |
| **22** | Reports | Mobile Reports View | 390×844 | Light | English | `test_artifacts/audit/22_mobile_reports_light.png` |
| **23** | Navigation | Mobile "More" Sheet Navigation Overlay | 390×844 | Light | English | `test_artifacts/audit/23_mobile_more_sheet.png` |
| **24** | Dashboard | Compact Android Phone View | 360×740 | Light | English | `test_artifacts/audit/24_mobile_360_dashboard.png` |

---

## 2. Separation of Observed Facts vs Design Opportunities

### Observed Facts (Verified Runtime Behavior)
1. **Layout & Responsiveness:**
   - The 3-primary + More mobile navigation (`c27c75b`) prevents 7-item horizontal tab overflow on phones.
   - The Getting Started Guide and Entry Modals open as centered dialogs on both mobile and desktop.
   - Table columns on Reports and Cashbook scroll horizontally within their containers on 390px/360px without expanding the page body width.
2. **Selectors & DOM Structure:**
   - Application tabs use `data-testid="tab-simple"`, `data-testid="tab-analytics"`, `data-testid="tab-dashboard"`, `data-testid="tab-cashbook"`, and `data-testid="tab-reports"`.
   - Primary voucher buttons are `data-testid="action-receive-money"` and `data-testid="action-pay-money"`.
   - Mobile navigation uses `data-testid="mobile-nav-more"`.
3. **Contrast & Theme:**
   - Dark mode uses Tailwind standard `bg-zinc-900` / `bg-zinc-950`.
   - The featured lime card in light mode uses `#ceeaa0`.

### Design Evaluation & Critique (Design Opinion & Opportunities)
1. **Surface Tonality:**
   - The current light theme relies on cold, stark blue-gray slate (`bg-slate-50`, `border-slate-200`). A warmer stone/paper surface (`#f8f9f6`) reduces visual fatigue during 10-hour business shifts.
2. **Featured Card Visual Glare:**
   - The `#ceeaa0` featured card is prominent, but in light mode, its high lime saturation commands disproportionate attention compared to actual balance figures. Calibrating with a warm double hairline border and balanced typography creates superior financial hierarchy.
3. **Modal to Mobile Sheet Progression:**
   - Centered dialogs on 390px/360px feel boxed-in. Converting transaction entry on mobile into an iOS/Android bottom sheet with drag handle improves thumb reachability.
4. **Tactile Interaction:**
   - Buttons currently have simple CSS background color transitions. Adding Emil Kowalski active-press scale (`0.975`) provides immediate physical confirmation of touches on mobile.

---

## 3. Financial Integrity & Verification Guardrails

Screenshot capture proves visual rendering, but does **not** prove financial calculation correctness or contrast compliance on its own. The redesign must continue to enforce:
1. Exact integer minor-unit arithmetic with half-up rounding (Rust and TypeScript parity).
2. Strict isolation of print media CSS (`@media print`) so UI controls never leak into A4/thermal vouchers.
3. WCAG 2.2 AA contrast ratios (minimum 4.5:1 for normal text, 3:1 for large numerals) across both Light and Dark themes.
