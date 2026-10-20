# BillZen UI Redesign — Visual & Motion References

Inspected on: 2026-10-20  
Role: Principal Product Designer & Motion Engineer  
Context: BillZen offline cashbook, billing, inventory & reporting application for India & GCC.

---

## 1. GSAP & React Motion References

### Official GSAP v3 & `@gsap/react`
- **Source**: [https://gsap.com/docs/v3/](https://gsap.com/docs/v3/) & [https://gsap.com/resources/React/](https://gsap.com/resources/React/)
- **Local Offline Implementation**: Installed locally in `package.json` (`"gsap": "^3.15.0"`, `"@gsap/react": "^2.1.2"`) and vendored into `docs/prototypes/vendor/gsap.min.js` (72 KB minified) for 100% offline, air-gapped execution with zero external CDN dependency.
- **Key Pattern**: `useGSAP` hook from `@gsap/react` provides automatic lifecycle scoping to React component trees and clean unmount disposal. In React 19 (which BillZen uses), `useGSAP` prevents memory leaks, dangling listeners, and duplicate tweens caused by Strict Mode reconciliation.
- **Responsive & Accessibility Integration**: [https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/)
  - `gsap.matchMedia()` handles both responsive viewport breakpoints (`(min-width: 1024px)`) and system accessibility preferences (`(prefers-reduced-motion: reduce)`).
  - For reduced-motion users, animations bypass duration and render instantaneous target values.
- **Showcase Analysis**: [https://gsap.com/showcase/](https://gsap.com/showcase/)
  - Demonstrates that the most professional enterprise applications use motion for **spatial orientation** (modals growing from buttons, drawers sliding from edges, subtle value highlight on update) rather than decorative loops.

---

## 2. Product & Visual Interface References

### Reference 1: Linear ([linear.app](https://linear.app))
- **Date Inspected**: 2026-10-20
- **Observed Patterns**:
  - Hairline borders (`border-slate-200/80` in light, `border-zinc-800` in dark) defining cards without heavy drop shadows.
  - Deep dark surfaces (`#09090b`, `#121214`) and clean off-white light surfaces (`#fcfcfc`, `#f4f4f5`).
  - Active tactile feedback on clickable rows (`transform: scale(0.985)`).
- **Fit for BillZen**: High-frequency business operations need calm, high-density clarity where borders separate data, not thick shadows.
- **Adaptation**: Use 1px subtle borders for cashbook ledger tables and transaction rows; apply instant active feedback on voucher entry buttons.

### Reference 2: Mercury ([mercury.com](https://mercury.com))
- **Date Inspected**: 2026-10-20
- **Observed Patterns**:
  - Financial cash card hierarchy: The net balance sits at the top with large, high-legibility display typography (`tabular-nums`), followed by clear inflows and outflows.
  - Restrained color application: Green and red are used only for monetary directions (Money In / Money Out) with supporting icons; the rest of the interface uses neutrals.
- **Fit for BillZen**: Prevents the "Christmas tree" effect common in amateur financial dashboards.
- **Adaptation**: Feature the Closing Balance and Net Cash Change prominently with quiet neutrals for account names and date stamps.

### Reference 3: Wise ([wise.com](https://wise.com))
- **Date Inspected**: 2026-10-20
- **Observed Patterns**:
  - Bold, high-visibility currency exponent display with zero truncation across international currencies.
  - Large, thumb-friendly mobile action sheets with 48px+ touch targets and clear confirmation CTA at the bottom.
- **Fit for BillZen**: BillZen supports 2-decimal (INR, AED, SAR, QAR, USD, EUR) and 3-decimal (KWD, BHD, OMR) currencies across Latin and Arabic RTL layouts.
- **Adaptation**: Guarantee currency symbol and integer minor unit alignment across all screen widths down to 320px.

### Reference 4: Stripe Dashboard ([dashboard.stripe.com](https://dashboard.stripe.com))
- **Date Inspected**: 2026-10-20
- **Observed Patterns**:
  - Segmented period controls (Today, Month, Year, Custom Range) tightly integrated with date step controls.
  - Separation between full period totals and filtered search results via contextual notification banners.
- **Fit for BillZen**: BillZen's Reports screen requires searching and filtering by party/category without destroying opening/closing balance math.
- **Adaptation**: Filter matching banner informs users of query results while top financial summary remains historically intact.

### Reference 5: Jakub Krehel UI Lab ([jakub.kr](https://jakub.kr))
- **Date Inspected**: 2026-10-20
- **Observed Patterns**:
  - Purposeful micro-motion: Drawer slide-in using `cubic-bezier(0.16, 1, 0.3, 1)` with slight opacity fade.
  - Button state responsiveness: Instant state shift on pointer down with subtle spring recovery.
- **Fit for BillZen**: Enhances perceived performance on both desktop mouse clicks and mobile touch interactions.
- **Adaptation**: Fast drawer modal transitions (200ms) with backdrop blur and smooth cubic easing.

### Reference 6: Ramp ([ramp.com](https://ramp.com))
- **Date Inspected**: 2026-10-20
- **Observed Patterns**:
  - Clean analytical category breakdown with percentage bars and subtle progress fills.
  - Non-intrusive informational helpers that explain data without cluttering primary figures.
- **Fit for BillZen**: Explains cash flow vs profit clearly in Detailed Analytics view.
- **Adaptation**: Horizontal proportion bars for category spending with non-profit accounting disclaimers.
