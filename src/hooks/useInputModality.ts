import { useEffect } from 'react';

// Shared while UI consumers are mounted: a pointer click on an already focused
// trigger must not be mistaken for keyboard input when opening a panel.
const input = { keyboard: false };
let consumers = 0;
const onKey = () => { input.keyboard = true; };
const onPointer = () => { input.keyboard = false; };

export function useInputModality() {
  useEffect(() => {
    if (consumers++ === 0) {
      input.keyboard = false;
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onPointer, true);
    }
    return () => {
      if (--consumers === 0) {
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('pointerdown', onPointer, true);
      }
    };
  }, []);
  return input;
}
