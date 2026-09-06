import { useEffect, useRef } from 'react';
import { FOCUSABLE } from './useModalFocus';
import { getActiveGamepad } from '../services/gamepads';
import { GamepadNavReader } from '../features/gamepad/navInput';
import { is8BitDoMicro } from '../features/gamepad/controllerIdentity';
import { MICRO_SELECT_BUTTON } from '../features/gamepad/microProfile';
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

function isGamepadNavCandidate(element: HTMLElement): boolean {
  if (element.closest('[data-gamepad-nav-exclude]')) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
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
  const connectedPadIndexRef = useRef<number | null>(null);
  const pendingInitialScriptFocusRef = useRef(false);

  useEffect(() => {
    const reader = new GamepadNavReader();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const pad = getActiveGamepad();
      if (!pad) {
        connectedPadIndexRef.current = null;
      } else if (connectedPadIndexRef.current !== pad.index) {
        connectedPadIndexRef.current = pad.index;
        pendingInitialScriptFocusRef.current = mode === 'scripts';
      }
      // Reprogramar pase lo que pase: una excepción puntual en un tick no debe
      // matar la navegación para el resto de la sesión.
      try {
        const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
        const dialog = dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
        const scope = dialog ?? (mode === 'scripts' ? document.body : null);
        const suspended = document.querySelector('[data-gamepad-nav-suspend]') !== null;

        if (mode !== 'scripts') pendingInitialScriptFocusRef.current = false;

        if (!pad || !scope || suspended) {
          // Fuera de ámbito no se consume nada; al volver, el primer frame ceba
          // para que una pulsación en curso no dispare acciones fantasma.
          reader.reset();
          delete document.documentElement.dataset.gamepadNavReady;
          return;
        }

        // Al descubrir un mando en la biblioteca, entra directamente por el
        // primer guion. Si aún se está cargando IndexedDB o hay un modal
        // abierto, conserva la intención y la aplica cuando el botón exista.
        if (pendingInitialScriptFocusRef.current && !dialog) {
          const firstScript = scope.querySelector<HTMLElement>(
            '[data-gamepad-script]:not(:disabled)'
          );
          if (firstScript) {
            firstScript.focus({ preventScroll: true });
            firstScript.scrollIntoView({ block: 'nearest' });
            markGamepadNavActive();
            pendingInitialScriptFocusRef.current = false;
          }
        }

        const frame = reader.update(pad, performance.now());
        const selectButton = pad.buttons[MICRO_SELECT_BUTTON];
        const microModifierPressed =
          is8BitDoMicro(pad.id) &&
          (selectButton?.pressed === true || (selectButton?.value ?? 0) > 0.5);
        // Baliza observable: el modo navegación está activo y cebado.
        document.documentElement.dataset.gamepadNavReady = 'true';
        if (frame.moves.length > 0 || frame.confirm || frame.back) markGamepadNavActive();

        if (frame.moves.length > 0) {
          const candidates = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            isGamepadNavCandidate
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

        if (frame.confirm && !microModifierPressed) {
          const active = document.activeElement;
          if (
            active instanceof HTMLElement &&
            scope.contains(active) &&
            isGamepadNavCandidate(active) &&
            !isRangeInput(active)
          ) {
            active.click();
          } else {
            // Nada elegible enfocado dentro del ámbito: Sur empieza a navegar.
            const first = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).find(
              isGamepadNavCandidate
            );
            first?.focus({ preventScroll: true });
          }
        }

        if (frame.back && dialog) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
      } finally {
        schedule(pad ? ACTIVE_TICK_MS : IDLE_TICK_MS);
      }
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
    schedule(0);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('gamepadconnected', onConnected);
      window.removeEventListener('pointerdown', onPointerDown);
      delete document.documentElement.dataset.gamepadNav;
      delete document.documentElement.dataset.gamepadNavReady;
    };
  }, [mode]);
}
