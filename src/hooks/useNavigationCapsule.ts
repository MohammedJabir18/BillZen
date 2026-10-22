import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import gsap from 'gsap';

// One owned timeline; geometry always comes from physical button bounds (also RTL).
export function useNavigationCapsule(
  navRef: RefObject<HTMLElement | null>,
  capsuleRef: RefObject<HTMLDivElement | null>,
  targetId: string,
  language: string,
) {
  const edges = useRef({ left: 0, right: 0, top: 0, bottom: 0 });
  const initialized = useRef(false);
  const keyboard = useRef(false);

  // Focus can disappear when the More sheet unmounts, before layout effects run.
  // Remember the initiating input instead of inferring it from the final target.
  useEffect(() => {
    const onKey = () => { keyboard.current = true; };
    const onPointer = () => { keyboard.current = false; };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, []);

  useLayoutEffect(() => {
    const nav = navRef.current, capsule = capsuleRef.current;
    if (!nav || !capsule) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timeline: gsap.core.Timeline | undefined;
    let measured = '';
    let disposed = false;
    const paint = () => {
      const { top, right, bottom, left } = edges.current;
      capsule.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round 12px)`;
    };
    const update = (animate = false, force = false) => {
      const target = nav.querySelector<HTMLElement>(`[data-testid="${targetId}"]`);
      if (!target) return;
      if (!target.getClientRects().length || !nav.clientWidth) {
        timeline?.kill(); initialized.current = false; capsule.style.visibility = 'hidden'; return;
      }
      // Layout offsets exclude the temporary active:scale press transform.
      // Both button and layer use the positioned nav as their containing block.
      const next = { left: target.offsetLeft, right: nav.clientWidth - target.offsetLeft - target.offsetWidth,
        top: target.offsetTop, bottom: nav.clientHeight - target.offsetTop - target.offsetHeight };
      const signature = JSON.stringify([next, nav.clientWidth, nav.clientHeight]);
      if (!force && signature === measured) return;
      measured = signature;
      timeline?.kill();
      capsule.style.visibility = 'visible';
      if (!animate || !initialized.current || media.matches || keyboard.current || target.matches(':focus-visible')) {
        Object.assign(edges.current, next); paint();
      } else {
        // Independent physical edges: leading edge first, trailing edge follows.
        // Retarget from current painted bounds without scale mirroring or layout writes.
        const movingRight = next.left > edges.current.left;
        timeline = gsap.timeline({ onUpdate: paint });
        timeline.to(edges.current, { left: next.left, duration: movingRight ? .55 : .36, ease: 'power3.out' }, 0)
          .to(edges.current, { right: next.right, duration: movingRight ? .36 : .55, ease: 'power3.out' }, 0)
          .to(edges.current, { top: next.top, bottom: next.bottom, duration: .36, ease: 'power3.out' }, 0);
      }
      initialized.current = true;
    };
    update(true);
    const resize = () => update();
    const observer = new ResizeObserver(resize);
    observer.observe(nav);
    nav.querySelectorAll('button').forEach(button => observer.observe(button));
    const preference = () => update(false, true);
    media.addEventListener('change', preference);
    document.fonts.addEventListener('loadingdone', resize);
    if (document.fonts.status === 'loading') {
      void document.fonts.ready.then(() => { if (!disposed) resize(); });
    }
    return () => {
      disposed = true;
      timeline?.kill();
      observer.disconnect();
      media.removeEventListener('change', preference);
      document.fonts.removeEventListener('loadingdone', resize);
    };
  }, [navRef, capsuleRef, targetId, language]);
}
