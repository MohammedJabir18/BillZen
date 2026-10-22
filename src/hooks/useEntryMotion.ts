import { useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useInputModality } from './useInputModality';

// Scoped, reversible effects: preference changes settle immediately and updates
// cannot accumulate tweens that retain partially animated financial summaries.
export function useEntryMotion(
  scope: RefObject<HTMLElement | null>,
  selector: string,
  dependencies: unknown[],
  kind: 'cards' | 'bars' = 'cards',
  ready = true,
) {
  const seen = useRef(new WeakSet<HTMLElement>());
  const input = useInputModality();
  useGSAP(() => {
    const nodes = scope.current?.querySelectorAll<HTMLElement>(selector);
    if (!ready || !nodes?.length) return;
    // Chart dependencies describe a new selected dataset: replay the whole
    // series, including keyed bars React retained from the previous period.
    const fresh = Array.from(nodes).filter(node => kind === 'bars' || !seen.current.has(node));
    const final = kind === 'bars' ? { scaleY: 1 } : { y: 0, opacity: 1 };
    // Set the origin before the first scale write; it must never interpolate.
    if (kind === 'bars') gsap.set(nodes, { transformOrigin: '50% 100%' });
    if (kind !== 'bars') gsap.set(Array.from(nodes).filter(node => seen.current.has(node)), final);
    let entered = false;
    const keyboard = input.keyboard;
    const media = gsap.matchMedia();
    media.add({ reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (context.conditions?.reduce || keyboard || entered) {
        gsap.set(nodes, final);
      } else {
        gsap.fromTo(fresh, kind === 'bars' ? { scaleY: 0 } : { y: 10, opacity: .85 },
          { ...final, duration: kind === 'bars' ? .42 : .26, stagger: kind === 'bars' ? 0 : .035,
            ease: 'power3.out', overwrite: 'auto' });
      }
      entered = true;
      nodes.forEach(node => seen.current.add(node));
    });
    return () => media.revert();
  }, { scope, dependencies: [...dependencies, ready], revertOnUpdate: true });
}
