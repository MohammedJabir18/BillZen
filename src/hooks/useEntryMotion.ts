import type { RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// Scoped, reversible effects: preference changes settle immediately and updates
// cannot accumulate tweens that retain partially animated financial summaries.
export function useEntryMotion(
  scope: RefObject<HTMLElement | null>,
  selector: string,
  dependencies: unknown[],
  kind: 'cards' | 'bars' = 'cards',
) {
  useGSAP(() => {
    const nodes = scope.current?.querySelectorAll<HTMLElement>(selector);
    if (!nodes?.length) return;
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const final = kind === 'bars' ? { scaleY: 1 } : { y: 0, opacity: 1 };
      if (context.conditions?.reduce || document.activeElement?.matches(':focus-visible')) {
        gsap.set(nodes, final);
      } else {
        gsap.fromTo(nodes, kind === 'bars' ? { scaleY: 0, transformOrigin: 'bottom' } : { y: 20, opacity: 0 },
          { ...final, duration: kind === 'bars' ? .3 : .26, stagger: kind === 'bars' ? .02 : .05,
            ease: 'power3.out', overwrite: 'auto' });
      }
    });
    return () => media.revert();
  }, { scope, dependencies, revertOnUpdate: true });
}
