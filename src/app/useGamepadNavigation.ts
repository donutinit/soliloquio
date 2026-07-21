import { useEffect } from 'react';
import { FOCUSABLE } from './useModalFocus';
import { getActiveGamepad } from '../features/gamepad/controller';
import { GamepadNavReader } from '../features/gamepad/navInput';
import { pickNext, type NavDirection, type NavRect } from '../features/gamepad/spatialNav';

/** Cadencia con mando conectado; sin mando, poll perezoso para no gastar batería. */
const ACTIVE_TICK_MS = 50;
const IDLE_TICK_MS = 400;

function toNavRect(rect: DOMRect): NavRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function isRangeInput(element: Element | null): element is HTMLInputElement {
  return element instanceof HTMLInputElement && element.type === 'range';
}

/** Ajusta un slider respetando min/max/step y notifica al onChange de React. */
function adjustRange(input: HTMLInputElement, direction: NavDirection): void {
  if (direction === 'right') input.stepUp();
  else input.stepDown();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function markGamepadNavActive(): void {
  document.documentElement.dataset.gamepadNav = 'true';
}

/**
 * Navegación global por gamepad: d-pad/stick izquierdo mueven el foco real del
 * DOM con salto espacial, Sur activa el elemento enfocado y Este cierra el
 * modal activo (Escape sintético, capturado por useModalFocus).
 *
 * El ámbito es el último `[role="dialog"]` abierto o, en la página de guiones,
 * el documento entero. En la ruta del prompter solo actúa con un panel
 * abierto: el lector es dueño del mando durante la lectura. Un elemento con
 * `data-gamepad-nav-suspend` (el panel Gamepad en modo escucha) pausa todo.
 */
export function useGamepadNavigation(mode: 'scripts' | 'prompter'): void {
  useEffect(() => {
    const reader = new GamepadNavReader();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const pad = getActiveGamepad();

      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
      const dialog = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
      const scope = dialog ?? (mode === 'scripts' ? document.body : null);
      const suspended = document.querySelector('[data-gamepad-nav-suspend]') !== null;

      if (!pad || !scope || suspended) {
        // Fuera de ámbito no se consume nada; al volver, el primer frame ceba
        // para que una pulsación en curso no dispare acciones fantasma.
        reader.reset();
        schedule(pad ? ACTIVE_TICK_MS : IDLE_TICK_MS);
        return;
      }

      const frame = reader.update(pad, performance.now());
      if (frame.moves.length > 0 || frame.confirm || frame.back) markGamepadNavActive();

      if (frame.moves.length > 0) {
        const candidates = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }
        );
        const rects = candidates.map((el) => toNavRect(el.getBoundingClientRect()));
        for (const direction of frame.moves) {
          const active = document.activeElement;
          if (isRangeInput(active) && (direction === 'left' || direction === 'right')) {
            adjustRange(active, direction);
            continue;
          }
          const fromIndex = active instanceof HTMLElement ? candidates.indexOf(active) : -1;
          const next = pickNext(rects, fromIndex >= 0 ? fromIndex : null, direction);
          if (next !== null) {
            candidates[next].focus({ preventScroll: true });
            candidates[next].scrollIntoView({ block: 'nearest' });
          }
        }
      }

      if (frame.confirm) {
        const active = document.activeElement;
        if (active instanceof HTMLElement && scope.contains(active) && !isRangeInput(active)) {
          active.click();
        } else if (!(active instanceof HTMLElement) || !scope.contains(active)) {
          // Nada enfocado dentro del ámbito: Sur empieza a navegar.
          const first = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).find((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          first?.focus({ preventScroll: true });
        }
      }

      if (frame.back && dialog) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }

      schedule(ACTIVE_TICK_MS);
    };

    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };

    const onConnected = () => schedule(0);
    const onPointerDown = () => {
      delete document.documentElement.dataset.gamepadNav;
    };
    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('pointerdown', onPointerDown);
    schedule(IDLE_TICK_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('gamepadconnected', onConnected);
      window.removeEventListener('pointerdown', onPointerDown);
      delete document.documentElement.dataset.gamepadNav;
    };
  }, [mode]);
}
