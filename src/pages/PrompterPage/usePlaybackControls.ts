import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { PrompterSettings } from '../../types';
import { applyKeepScreenAwake } from '../../services/keepAwake';
import type { ScrollEngine } from '../../features/prompter/scrollEngine';

type PlaybackControlsParams = {
  requireEngine: () => ScrollEngine;
  settingsRef: MutableRefObject<PrompterSettings>;
  wakeLoopRef: MutableRefObject<() => void>;
  revealControls: () => void;
};

/**
 * Estado de reproducción del lector: play/pausa, cuenta atrás opcional de
 * arranque y vuelta al inicio. No toca el DOM: el motor de scroll y el bucle
 * de pintado viven fuera de este hook.
 */
export function usePlaybackControls({
  requireEngine,
  settingsRef,
  wakeLoopRef,
  revealControls
}: PlaybackControlsParams) {
  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<number | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    countdownRef.current = null;
    setCountdown(null);
  }, []);

  const resetToStart = useCallback(() => {
    clearCountdown();
    const engine = requireEngine();
    engine.state.playing = false;
    engine.seek(0);
    setPlaying(false);
    revealControls();
    wakeLoopRef.current();
  }, [clearCountdown, requireEngine, revealControls, wakeLoopRef]);

  const togglePlay = useCallback(
    (revealControlsOnStop: boolean) => {
      // A gamepad action does not emit a DOM click, so explicitly retry a wake
      // lock here after a transient browser denial or an iOS lifecycle release.
      applyKeepScreenAwake(settingsRef.current.keepScreenAwake);

      if (countdownRef.current !== null) {
        clearCountdown();
        if (revealControlsOnStop) revealControls();
        return;
      }

      const engine = requireEngine();
      if (engine.state.playing) {
        engine.state.playing = false;
        setPlaying(false);
        if (revealControlsOnStop) revealControls();
        wakeLoopRef.current();
        return;
      }

      // Un guion que cabe entero en pantalla no tiene recorrido: Play no arranca
      // una cuenta atrás ni un desplazamiento imposible.
      if (engine.maxPosition <= 0) {
        revealControls();
        return;
      }

      if (engine.state.position >= engine.maxPosition - 1) {
        engine.seek(0);
      }

      const seconds = settingsRef.current.countdownSeconds;
      if (seconds > 0) {
        countdownRef.current = seconds;
        setCountdown(seconds);
        countdownTimerRef.current = setInterval(() => {
          const current = countdownRef.current;
          if (current === null) return;
          if (current <= 1) {
            clearCountdown();
            applyKeepScreenAwake(settingsRef.current.keepScreenAwake);
            engine.state.playing = true;
            setPlaying(true);
            wakeLoopRef.current();
            return;
          }
          countdownRef.current = current - 1;
          setCountdown(current - 1);
        }, 1000);
        return;
      }

      engine.state.playing = true;
      setPlaying(true);
      wakeLoopRef.current();
    },
    [clearCountdown, requireEngine, revealControls, settingsRef, wakeLoopRef]
  );

  useEffect(
    () => () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    },
    []
  );

  return { playing, setPlaying, countdown, togglePlay, resetToStart };
}
