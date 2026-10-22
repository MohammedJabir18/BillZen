# Motion Pass Design: Precision Ledger Elasticity

## Intent & Why
The goal is to implement a "motion language" based on a provided reference video, bringing a high-end, tactile feel to BillZen without changing its layout, colors, or branding. The core is the "elastic navigation capsule" which provides a physical sense of movement between sections.

## Goals
- **Elastic Navigation**: A decorative pill that moves between tabs with a leading-edge-first, trailing-edge-catch-up effect.
- **Tactile Feedback**: Consistent 120-150ms micro-interactions for buttons and cards.
- **Coherent Transitions**: 200-260ms purposeful entry/exit for panels and modals.
- **Zero-Lag Productivity**: Navigation state updates immediately; the animation is a decorative "follow-through".

## Non-Goals
- No redesign of layout, colors, or typography.
- No new animation libraries (stick to GSAP and CSS).
- No "slop" (glow, 3D tilt, perpetual loops).
- No delay in functional navigation.

## Constraints
- **RTL Support**: Animation must mirror for Arabic.
- **Reduced Motion**: Must jump to final state if `prefers-reduced-motion: reduce`.
- **Touch/Coarse Pointer**: No hover-only critical state; press feedback must be clear.
- **Print Isolation**: Motion must not affect PDF/Print output.

## Approaches

### 1. The "Clipped Layer" Approach (Reference)
Use a full-size background layer clipped to the target item's bounds.
- **Pros**: High precision, matches reference video's "elastic" feel.
- **Cons**: Slightly more complex DOM management.
- **Verdict**: Recommended for the Navigation Capsule.

### 2. The "CSS Transition" Approach
Use simple CSS `transition` on `left` and `width`.
- **Pros**: Simple, performant.
- **Cons**: Cannot achieve the separate leading/trailing edge "stretch" effect.
- **Verdict**: Use for simple hover/color states only.

### 3. The "GSAP-Managed" Approach
Use GSAP to coordinate the transform and scale of the capsule.
- **Pros**: Full control over easing (`power3.out`), interruption handling, and cleanup.
- **Cons**: Requires careful scoping with `useGSAP`.
- **Verdict**: Recommended for all primary motion.

## The Motion Budget
| Element | Duration | Easing | Purpose |
|---|---|---|---|
| Button Press | 120-150ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Tactile confirmation |
| Nav Capsule | 360ms (lead) / 550ms (trail) | `power3.out` / `power3.inOut` | Spatial continuity |
| Panels/Drawers | 200-240ms | `power3.out` | Hierarchy shift |
| Modals | 220-260ms | `power3.out` | Focus shift |

## Implementation Plan
1. **Nav Capsule**: Create a `NavigationCapsule` component. Use GSAP to animate its position and width. Implement the "stretch" by animating the width and position with a slight offset.
2. **Tactile Pass**: Audit all buttons for `active:scale-[0.975]`. Add a small GSAP hover effect to cards.
3. **Drawer Pass**: Animate the `More` drawer using GSAP.
4. **Verification**: Test RTL, reduced motion, and performance.

## Implemented boundary — 2026-10-22

The navigation capsule is now a clipped decorative layer with independent physical leading/trailing edges (360/550ms) owned by `useNavigationCapsule`. Active button styling remains immediate, readable and in the existing palette; label/icon layers sit above decoration. Geometry uses layout offsets, ignoring transient press-scale transforms. ResizeObserver observes the navigation and buttons; font changes, hidden breakpoints, secondary destinations and RTL are supported. Resize, keyboard and reduced-motion changes settle immediately. Every transition stops its predecessor and removes listeners/observers on cleanup.

`useEntryMotion` scopes Dashboard/Cashbook summary and Analytics bar effects with explicit final values, update reversion and live media-query cleanup. Chart effects include asynchronous ledger readiness. Financial numbers are never interpolated. Existing tactile button styles and modal behavior are preserved. Adding drawer/dialog choreography or general card hover effects is a later section; this repair does not claim those are implemented.

`npm run test:motion` exercises actual built browser behavior in isolated storage, including long press, keyboard More selection, live reduced-motion changes, rapid filters/routes, seeded analytics and animated RTL. The former capture helper delegates to this checked runner. Performance acceptance here is limited to build size and interruptibility; no device FPS or all-platform runtime claim is made.
