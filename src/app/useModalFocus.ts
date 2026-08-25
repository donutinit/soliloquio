import { useEffect, useRef } from 'react';

export const FOCUSABLE =
  'button:not([disabled]), a[href], area[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps keyboard focus inside a modal, supports Escape and restores focus. */
export function useModalFocus<T extends HTMLElement>(onClose: () => void) {
  const modalRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    if (!modal) return;

    const focusables = () => Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE));
    const frame = requestAnimationFrame(() => {
      const preferred = modal.querySelector<HTMLElement>('[data-modal-autofocus]');
      (preferred ?? focusables()[0])?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return modalRef;
}
