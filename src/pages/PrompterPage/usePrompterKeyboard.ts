import { useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';

export type Panel = 'none' | 'settings' | 'sections' | 'controllerGuide';

type PrompterKeyboardParams = {
  panelRef: MutableRefObject<Panel>;
  togglePlayRef: MutableRefObject<(revealControlsOnStop: boolean) => void>;
  playButtonRef: RefObject<HTMLButtonElement>;
  revealControls: () => void;
};

// Teclado: con los controles ocultos no hay superficie táctil que los
// devuelva. Cualquier tecla los revela; Tab enfoca Play directamente y
// Espacio pausa/reanuda, también como atajo con los controles visibles.
export function usePrompterKeyboard({
  panelRef,
  togglePlayRef,
  playButtonRef,
  revealControls
}: PrompterKeyboardParams) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (panelRef.current !== 'none') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('button, a[href], input, textarea, select, [tabindex]')
      ) {
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        revealControls();
        requestAnimationFrame(() => playButtonRef.current?.focus());
        return;
      }
      if (event.key === 'Escape') {
        revealControls();
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        togglePlayRef.current(true);
        return;
      }
      revealControls();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelRef, togglePlayRef, playButtonRef, revealControls]);
}
