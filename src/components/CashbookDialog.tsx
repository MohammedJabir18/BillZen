import { useEffect, useRef, type ReactNode } from 'react';

// Cashbook dialogs can nest (entry → category or balance confirmation).
// Only the top layer owns focus. Escape/Android Back remain in useBackHandler.
const layers: HTMLElement[] = [];
let previousOverflow = '';
// Reference counts preserve pre-existing inert state and survive nested layers.
const inertLeases = new Map<HTMLElement, { count: number; previous: boolean; previousAriaHidden: string | null }>();
function maskBackground(root: HTMLElement) {
  const masked: HTMLElement[] = [];
  for (let branch = root; branch.parentElement; branch = branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.matches('script,style')) continue;
      const lease = inertLeases.get(sibling) ?? { count: 0, previous: sibling.inert, previousAriaHidden: sibling.getAttribute('aria-hidden') };
      lease.count++;
      inertLeases.set(sibling, lease);
      sibling.inert = true;
      sibling.setAttribute('aria-hidden', 'true');
      masked.push(sibling);
    }
    if (branch.parentElement === document.body) break;
  }
  return () => {
    for (const element of masked) {
      const lease = inertLeases.get(element)!;
      if (--lease.count === 0) {
        element.inert = lease.previous;
        if (lease.previousAriaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', lease.previousAriaHidden);
        inertLeases.delete(element);
      }
    }
  };
}
const focusable = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
)].filter(element => element.getClientRects().length > 0 && !element.closest('[inert]'));

export function CashbookDialog({ label, className, children }: {
  label: string; className: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!layers.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    layers.push(root);
    const focusInitial = () => {
      const preferred = root.querySelector<HTMLElement>('[data-dialog-initial-focus]:not(:disabled)');
      (preferred ?? focusable(root)[0] ?? root).focus({ preventScroll: true });
    };
    focusInitial();
    const unmask = maskBackground(root);
    const onKeyDown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== root || event.key !== 'Tab') return;
      const controls = focusable(root);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) { event.preventDefault(); root.focus(); return; }
      if (!root.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last! : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (layers.at(-1) === root && !root.contains(event.target as Node)) focusInitial();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      const index = layers.indexOf(root);
      if (index !== -1) layers.splice(index, 1);
      unmask();
      if (!layers.length) document.body.style.overflow = previousOverflow;
      // Do not focus a removed submit trigger or steal focus from a newer layer.
      queueMicrotask(() => {
        const top = layers.at(-1);
        if (trigger?.isConnected && (!top || top.contains(trigger))) trigger.focus({ preventScroll: true });
      });
    };
  }, []);
  return <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={className}>{children}</div>;
}
