import { useEffect, useRef } from 'react';

/**
 * Global LIFO stack of modal dismiss handlers.
 * When Escape or Android back button is triggered, only the topmost active dialog handler is popped and executed,
 * preventing nested modals from all closing simultaneously.
 */
const handlerStack: Array<() => void> = [];

if (typeof window !== 'undefined') {
  const popAndExecute = (e: Event) => {
    if (handlerStack.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const topHandler = handlerStack[handlerStack.length - 1];
      topHandler();
    }
  };

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      popAndExecute(e);
    }
  });

  window.addEventListener('billzen-back-button', (e: Event) => {
    popAndExecute(e);
  });
}

export function useBackHandler(isOpen: boolean, onDismiss: () => void) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!isOpen) return;

    const handler = () => {
      dismissRef.current();
    };

    handlerStack.push(handler);

    return () => {
      const idx = handlerStack.lastIndexOf(handler);
      if (idx !== -1) {
        handlerStack.splice(idx, 1);
      }
    };
  }, [isOpen]);
}
