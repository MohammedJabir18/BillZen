import type { RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useInputModality } from './useInputModality';

// Presentation only: focus, dismissal, form submission and layer ownership stay
// with the caller. Closing never waits for an exit animation.
export function usePanelMotion(
  ref: RefObject<HTMLDivElement | null>,
  open: boolean,
  kind: 'drawer' | 'dialog',
) {
  const input = useInputModality();
  useGSAP(() => {
    if (!open || !ref.current) return;
    const panel = kind === 'drawer' ? ref.current : ref.current.firstElementChild;
    if (!(panel instanceof HTMLElement)) return;
    const keyboard = input.keyboard;
    let entered = false;
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (context.conditions?.reduce || keyboard || entered) {
        gsap.set(panel, { y: 0, opacity: 1 });
      } else {
        gsap.fromTo(panel, { y: kind === 'drawer' ? 12 : 8, opacity: .85 },
          { y: 0, opacity: 1, duration: kind === 'drawer' ? .22 : .24,
            ease: 'power3.out', overwrite: 'auto' });
      }
      entered = true;
    });
    return () => media.revert();
  }, { scope: ref, dependencies: [open, kind], revertOnUpdate: true });
}
