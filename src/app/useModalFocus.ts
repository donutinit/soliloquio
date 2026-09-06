import { useEffect, useRef } from 'react';

export const FOCUSABLE =
  'button:not([disabled]), a[href], area[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type VisibilityCheckable = {
  checkVisibility?: (options?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean;
};

function isRendered(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0) return false;
  const check = (element as HTMLElement & VisibilityCheckable).checkVisibility;
  // La opacidad se ignora: las animaciones de entrada de los paneles arrancan
  // en opacity 0 y no deben invalidar el autofocus del propio panel.
  if (typeof check === 'function') return check.call(element, { checkOpacity: false, checkVisibilityCSS: true });
  return true;
}

/** Keeps keyboard focus inside a modal, supports Escape and restores focus. */
export function useModalFocus<T extends HTMLElement>(onClose: () => void) {
  const modalRef = useRef<T>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    if (!modal) return;

    const focusables = () =>
      Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isRendered);
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
      const active = document.activeElement;
      const activeIndex = active instanceof HTMLElement ? items.indexOf(active) : -1;
      if (activeIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && activeIndex === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeIndex === items.length - 1) {
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
