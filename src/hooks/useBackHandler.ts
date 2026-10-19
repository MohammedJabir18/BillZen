import { useEffect } from 'react';

/**
 * Custom hook to handle Android back button and Desktop Escape key dismissal for modals.
 * Intercepts 'billzen-back-button' (dispatched from Android native MainActivity)
 * and 'keydown' (Escape key). Calls onDismiss and marks the event as handled.
 */
export function useBackHandler(isOpen: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    };

    const handleCustomBack = (e: Event) => {
      e.preventDefault(); // Marks it handled so Android MainActivity does not exit the app
      e.stopPropagation();
      onDismiss();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('billzen-back-button', handleCustomBack);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('billzen-back-button', handleCustomBack);
    };
  }, [isOpen, onDismiss]);
}
