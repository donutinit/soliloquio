import { useEffect } from 'react';
import type { MutableRefObject, RefObject } from 'react';

export type Panel = 'none' | 'settings' | 'sections' | 'controllerGuide';
export type KeyboardCommand =
  | 'scrollUp'
  | 'scrollDown'
  | 'pageUp'
  | 'pageDown'
  | 'start'
  | 'end'
  | 'prevSection'
  | 'nextSection'
  | 'speedDown'
  | 'speedUp';

type PrompterKeyboardParams = {
  panelRef: MutableRefObject<Panel>;
  togglePlayRef: MutableRefObject<(revealControlsOnStop: boolean) => void>;
  playButtonRef: RefObject<HTMLButtonElement>;
  revealControls: () => void;
  onCommand: (command: KeyboardCommand) => void;
};

const KEY_COMMANDS: Record<string, KeyboardCommand> = {
  ArrowUp: 'scrollUp',
  ArrowDown: 'scrollDown',
  PageUp: 'pageUp',
  PageDown: 'pageDown',
  Home: 'start',
  End: 'end',
  ArrowLeft: 'prevSection',
  ArrowRight: 'nextSection',
  '-': 'speedDown',
  _: 'speedDown',
  '+': 'speedUp',
  '=': 'speedUp'
};

export function usePrompterKeyboard({
  panelRef,
  togglePlayRef,
  playButtonRef,
  revealControls,
  onCommand
}: PrompterKeyboardParams) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (panelRef.current !== 'none') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      const onControl =
        event.target instanceof HTMLElement &&
        event.target.closest('button, a[href], [tabindex]') !== null;
      if (event.key === 'Tab') {
        if (onControl) return;
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
        if (onControl) return;
        event.preventDefault();
        togglePlayRef.current(true);
        return;
      }
      const command = KEY_COMMANDS[event.key];
      if (command) {
        event.preventDefault();
        onCommand(command);
        revealControls();
        return;
      }
      revealControls();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panelRef, togglePlayRef, playButtonRef, revealControls, onCommand]);
}
