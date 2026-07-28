import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { PrompterSettings, Script } from '../../types';
import { getScript, getSettings, saveSettings } from '../../services/database';
import { applyKeepScreenAwake } from '../../services/keepAwake';
import { scriptToBlocks } from '../../features/markdown/flatten';
import { buildSections, currentSectionIndex, stepSection } from '../../features/sections/sections';
import { ScrollEngine } from '../../features/prompter/scrollEngine';
import { GamepadController, getActiveGamepad, type GamepadAction } from '../../features/gamepad/controller';
import {
  gamepadIconName,
  identifyController,
  type ControllerFamily
} from '../../features/gamepad/controllerIdentity';
import {
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS,
  clampToLimit
} from '../../features/settings/settings';
import { SettingsPanel } from './SettingsPanel';
import { SectionNav } from './SectionNav';
import { ControllerGuide } from './ControllerGuide';
import { editorHash } from '../../app/router';
import { Icon } from '../../components/Icon';
import styles from './PrompterPage.module.css';

/** Línea de lectura: fracción del alto del viewport donde se considera que se lee. */
const READING_LINE_FRACTION = 0.4;
const IDLE_POLL_INTERVAL_MS = 250;
const PLAYBACK_CONTROLS_AUTO_HIDE_MS = 1000;
const ADJUSTMENT_FEEDBACK_HOLD_MS = 720;
const ADJUSTMENT_FEEDBACK_EXIT_MS = 220;

type Panel = 'none' | 'settings' | 'sections' | 'controllerGuide';
type AdjustableSetting = 'speed' | 'fontSize' | 'horizontalMargin';
type AdjustmentFeedback = {
  key: AdjustableSetting;
  value: number;
  phase: 'visible' | 'exiting';
};

const ADJUSTMENT_DISPLAY: Record<
  AdjustableSetting,
  { label: string; unit: string; min: number; max: number }
> = {
  speed: {
    label: 'Speed',
    unit: '',
    min: SPEED_LIMITS.min,
    max: SPEED_LIMITS.max
  },
  fontSize: {
    label: 'Text size',
    unit: 'px',
    min: FONT_LIMITS.min,
    max: FONT_LIMITS.max
  },
  horizontalMargin: {
    label: 'Margins',
    unit: '%',
    min: MARGIN_LIMITS.min,
    max: MARGIN_LIMITS.max
  }
};

function adjustmentProgress(key: AdjustableSetting, value: number): number {
  const display = ADJUSTMENT_DISPLAY[key];
  return ((value - display.min) / (display.max - display.min)) * 100;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function PrompterPage({
  scriptId,
  navigate,
  returnToScripts
}: {
  scriptId: string;
  navigate: (hash: string) => void;
  returnToScripts: (focusScriptId?: string) => void;
}) {
  const [script, setScript] = useState<Script | null>(null);
  const [settings, setSettings] = useState<PrompterSettings | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setScript(null);
    setSettings(null);
    setMissing(false);
    setLoadError(false);
    void Promise.all([getScript(scriptId), getSettings()])
      .then(([loadedScript, loadedSettings]) => {
        if (cancelled) return;
        if (!loadedScript) {
          setMissing(true);
          return;
        }
        setScript(loadedScript);
        setSettings(loadedSettings);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  if (loadError) {
    return (
      <div className={styles.missing} role="alert">
        <p>This script could not be opened. Check available device storage and try again.</p>
        <button type="button" onClick={() => navigate('#/')}>Back to scripts</button>
      </div>
    );
  }

  if (missing) {
    return (
      <div className={styles.missing}>
        <p>This script no longer exists.</p>
        <button type="button" onClick={() => navigate('#/')}>
          Back to scripts
        </button>
      </div>
    );
  }

  if (!script || !settings) return <div className={styles.missing} role="status">Opening script…</div>;

  return (
    <Prompter
      script={script}
      initialSettings={settings}
      navigate={navigate}
      returnToScripts={returnToScripts}
    />
  );
}

function Prompter({
  script,
  initialSettings,
  navigate,
  returnToScripts
}: {
  script: Script;
  initialSettings: PrompterSettings;
  navigate: (hash: string) => void;
  returnToScripts: (focusScriptId?: string) => void;
}) {
  const blocks = useMemo(() => scriptToBlocks(script), [script]);
  const sections = useMemo(() => buildSections(blocks), [blocks]);

  const [settings, setSettingsState] = useState(initialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsActivity, setControlsActivity] = useState(0);
  const [panel, setPanel] = useState<Panel>('none');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [padFamily, setPadFamily] = useState<ControllerFamily>('playstation');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [adjustmentFeedback, setAdjustmentFeedback] = useState<AdjustmentFeedback | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLElement>(null);
  const blockElsRef = useRef<(HTMLElement | null)[]>([]);
  const sectionOffsetsRef = useRef<number[]>([]);
  const sectionIdxRef = useRef(0);
  const panelRef = useRef<Panel>('none');
  panelRef.current = panel;
  const gamepadConnectedRef = useRef(false);
  const padIdRef = useRef<string | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const dragRef = useRef<{ y: number; moved: boolean; startedAt: number } | null>(null);
  const settingsDirtyRef = useRef(false);
  const settingsSaveRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const wakeLoopRef = useRef<() => void>(() => undefined);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const lastTimeDisplayRef = useRef('');
  const renderedPositionRef = useRef(Number.NaN);
  const exitingRef = useRef(false);
  const manualWakeActiveRef = useRef(false);
  const adjustmentExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adjustmentRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const engineRef = useRef<ScrollEngine | null>(null);
  if (!engineRef.current) {
    const engine = new ScrollEngine();
    engine.state.baseSpeed = initialSettings.speed;
    engine.state.position = 0;
    engineRef.current = engine;
  }
  const controllerRef = useRef<GamepadController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new GamepadController(initialSettings.controllerBindings);
  }

  useEffect(() => {
    engineRef.current!.state.baseSpeed = settings.speed;
  }, [settings.speed]);

  useEffect(() => {
    controllerRef.current!.setBindings(settings.controllerBindings);
  }, [settings.controllerBindings]);

  // Al cerrar un panel, descarta la pulsación que lo cerró: su release ya no
  // debe disparar la acción del lector asignada a ese botón.
  useEffect(() => {
    if (panel === 'none') controllerRef.current!.reset();
  }, [panel]);

  const persistSettings = useCallback((): Promise<boolean> => {
    if (!settingsDirtyRef.current) return settingsSaveRef.current;
    const snapshot = settingsRef.current;
    const operation = settingsSaveRef.current.then(async () => {
      try {
        await saveSettings(snapshot);
        if (settingsRef.current === snapshot) settingsDirtyRef.current = false;
        return true;
      } catch {
        setStorageError('Settings could not be saved. Check available device storage.');
        return false;
      }
    });
    settingsSaveRef.current = operation;
    return operation;
  }, []);

  // Persist settings after a short idle period and once more when leaving the route.
  useEffect(() => {
    if (settings === initialSettings) return;
    const timer = setTimeout(() => void persistSettings(), 400);
    return () => clearTimeout(timer);
  }, [settings, initialSettings, persistSettings]);

  useEffect(
    () => () => {
      void persistSettings();
    },
    [persistSettings]
  );

  const jumpToSection = useCallback(
    (idx: number) => {
      const target = stepSection(idx, 0, sections.length);
      const readingLine = (viewportRef.current?.clientHeight ?? 0) * READING_LINE_FRACTION;
      // Place the section heading on the reading line instead of under the top controls.
      engineRef.current!.seek((sectionOffsetsRef.current[target] ?? 0) - readingLine);
      sectionIdxRef.current = target;
      setSectionIdx(target);
      wakeLoopRef.current();
    },
    [sections.length]
  );

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
    const engine = engineRef.current!;
    engine.state.playing = false;
    engine.seek(0);
    hasStartedRef.current = false;
    setPlaying(false);
    setControlsVisible(true);
    wakeLoopRef.current();
  }, [clearCountdown]);

  const togglePlay = useCallback(() => {
    // A gamepad action does not emit a DOM click, so explicitly retry a wake
    // lock here after a transient browser denial or an iOS lifecycle release.
    applyKeepScreenAwake(settingsRef.current.keepScreenAwake);

    if (countdownRef.current !== null) {
      clearCountdown();
      setControlsVisible(true);
      return;
    }

    const engine = engineRef.current!;
    if (engine.state.playing) {
      engine.state.playing = false;
      setPlaying(false);
      setControlsVisible(true);
      wakeLoopRef.current();
      return;
    }

    if (engine.state.position >= engine.maxPosition - 1) {
      engine.seek(0);
      hasStartedRef.current = false;
    }

    const seconds = settingsRef.current.countdownSeconds;
    if (!hasStartedRef.current && seconds > 0) {
      countdownRef.current = seconds;
      setCountdown(seconds);
      countdownTimerRef.current = setInterval(() => {
        const current = countdownRef.current;
        if (current === null) return;
        if (current <= 1) {
          clearCountdown();
          applyKeepScreenAwake(settingsRef.current.keepScreenAwake);
          hasStartedRef.current = true;
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

    hasStartedRef.current = true;
    engine.state.playing = true;
    setPlaying(true);
    wakeLoopRef.current();
  }, [clearCountdown]);

  useEffect(
    () => () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (adjustmentExitTimerRef.current) clearTimeout(adjustmentExitTimerRef.current);
      if (adjustmentRemoveTimerRef.current) clearTimeout(adjustmentRemoveTimerRef.current);
    },
    []
  );

  const exitToScripts = useCallback((restoreGamepadFocus: boolean) => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    void persistSettings().then((saved) => {
      if (saved) returnToScripts(restoreGamepadFocus ? script.id : undefined);
      else exitingRef.current = false;
    });
  }, [persistSettings, returnToScripts, script.id]);

  const editScript = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    void persistSettings().then((saved) => {
      if (saved) navigate(editorHash(script.id));
      else exitingRef.current = false;
    });
  }, [navigate, persistSettings, script.id]);

  const showAdjustmentFeedback = useCallback((key: AdjustableSetting, value: number) => {
    if (adjustmentExitTimerRef.current) clearTimeout(adjustmentExitTimerRef.current);
    if (adjustmentRemoveTimerRef.current) clearTimeout(adjustmentRemoveTimerRef.current);
    adjustmentExitTimerRef.current = null;
    adjustmentRemoveTimerRef.current = null;
    setAdjustmentFeedback({ key, value, phase: 'visible' });
    adjustmentExitTimerRef.current = setTimeout(() => {
      adjustmentExitTimerRef.current = null;
      setAdjustmentFeedback((current) =>
        current ? { ...current, phase: 'exiting' } : null
      );
      adjustmentRemoveTimerRef.current = setTimeout(() => {
        adjustmentRemoveTimerRef.current = null;
        setAdjustmentFeedback(null);
      }, ADJUSTMENT_FEEDBACK_EXIT_MS);
    }, ADJUSTMENT_FEEDBACK_HOLD_MS);
  }, []);

  const updateSetting = useCallback((key: AdjustableSetting, value: number) => {
    const limit =
      key === 'speed' ? SPEED_LIMITS : key === 'fontSize' ? FONT_LIMITS : MARGIN_LIMITS;
    const normalizedValue = clampToLimit(value, limit);
    const current = settingsRef.current;
    if (current[key] === normalizedValue) return;
    const next = { ...current, [key]: normalizedValue };
    settingsRef.current = next;
    settingsDirtyRef.current = true;
    setSettingsState(next);
    showAdjustmentFeedback(key, normalizedValue);
  }, [showAdjustmentFeedback]);

  const applyAction = useCallback(
    (action: GamepadAction) => {
      const current = settingsRef.current;
      switch (action) {
        case 'togglePlay':
          togglePlay();
          break;
        case 'resetToStart':
          resetToStart();
          break;
        case 'backToScripts':
          exitToScripts(true);
          break;
        case 'toggleControls':
          setControlsVisible((v) => !v);
          break;
        case 'prevSection':
          jumpToSection(stepSection(sectionIdxRef.current, -1, sections.length));
          break;
        case 'nextSection':
          jumpToSection(stepSection(sectionIdxRef.current, 1, sections.length));
          break;
        case 'speedDown':
          updateSetting('speed', current.speed - SPEED_LIMITS.step);
          break;
        case 'speedUp':
          updateSetting('speed', current.speed + SPEED_LIMITS.step);
          break;
        case 'fontUp':
          updateSetting('fontSize', current.fontSize + FONT_LIMITS.step);
          break;
        case 'fontDown':
          updateSetting('fontSize', current.fontSize - FONT_LIMITS.step);
          break;
        case 'marginUp':
          updateSetting('horizontalMargin', current.horizontalMargin + MARGIN_LIMITS.step);
          break;
        case 'marginDown':
          updateSetting('horizontalMargin', current.horizontalMargin - MARGIN_LIMITS.step);
          break;
        case 'toggleSettings':
          setPanel((p) => (p === 'settings' ? 'none' : 'settings'));
          break;
        case 'toggleControllerGuide':
          setPanel((p) => (p === 'controllerGuide' ? 'none' : 'controllerGuide'));
          break;
        case 'toggleSections':
          setPanel((p) => (p === 'sections' ? 'none' : 'sections'));
          break;
      }
    },
    [togglePlay, resetToStart, exitToScripts, jumpToSection, updateSetting, sections.length]
  );
  const applyActionRef = useRef(applyAction);
  applyActionRef.current = applyAction;

  // Medición real del DOM: offsets de sección y posición máxima.
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const measure = () => {
      sectionOffsetsRef.current = sections.map(
        (section) => blockElsRef.current[section.startBlockIndex]?.offsetTop ?? 0
      );
      engineRef.current!.setMaxPosition(content.scrollHeight - viewport.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [sections, blocks]);

  // Gamepad + scrolling. When paused without a controller this drops to a low
  // polling rate to avoid spending battery on a permanent 60 fps loop.
  useEffect(() => {
    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let scheduled = false;

    const requestSoon = () => {
      if (scheduled) return;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      scheduled = true;
      rafId = requestAnimationFrame(loop);
    };
    const scheduleNext = () => {
      if (
        engineRef.current!.state.playing ||
        gamepadConnectedRef.current ||
        dragRef.current
      ) {
        requestSoon();
      } else {
        timeoutId = setTimeout(requestSoon, IDLE_POLL_INTERVAL_MS);
      }
    };
    const loop = (now: number) => {
      scheduled = false;
      const engine = engineRef.current!;
      const pad = getActiveGamepad();
      const frame = controllerRef.current!.update(pad, now);
      const padId = pad?.id ?? null;
      if (padId !== padIdRef.current) {
        padIdRef.current = padId;
        if (pad) setPadFamily(identifyController(pad.id).family);
      }
      if (frame.connected !== gamepadConnectedRef.current) {
        gamepadConnectedRef.current = frame.connected;
        setGamepadConnected(frame.connected);
      }
      const manualWakeActive = panelRef.current === 'none' && Math.abs(frame.manualVelocity) > 0;
      if (manualWakeActive && !manualWakeActiveRef.current) {
        applyKeepScreenAwake(settingsRef.current.keepScreenAwake);
      }
      manualWakeActiveRef.current = manualWakeActive;
      // Con un panel abierto, el mando navega el panel (hook global): las
      // acciones del lector y el scroll manual quedan suspendidos.
      if (panelRef.current === 'none') {
        for (const action of frame.actions) applyActionRef.current(action);
        const direction = Math.sign(frame.manualVelocity) as -1 | 0 | 1;
        engine.setManual(direction, Math.abs(frame.manualVelocity));
      } else {
        engine.setManual(0, 0);
      }
      const position = engine.tick(now);
      if (contentRef.current && position !== renderedPositionRef.current) {
        contentRef.current.style.transform = `translate3d(0, ${-position}px, 0)`;
        renderedPositionRef.current = position;
      }
      if (engine.state.playing && position >= engine.maxPosition) {
        engine.state.playing = false;
        setPlaying(false);
        setControlsVisible(true);
      }
      const readingLine = (viewportRef.current?.clientHeight ?? 0) * READING_LINE_FRACTION;
      const idx = currentSectionIndex(sectionOffsetsRef.current, position, readingLine);
      if (idx !== sectionIdxRef.current) {
        sectionIdxRef.current = idx;
        setSectionIdx(idx);
      }
      const timeDisplay = `${Math.round(position)}:${Math.round(engine.maxPosition)}:${settingsRef.current.speed}`;
      if (timeDisplay !== lastTimeDisplayRef.current) {
        lastTimeDisplayRef.current = timeDisplay;
        const speed = settingsRef.current.speed;
        if (elapsedRef.current) elapsedRef.current.textContent = formatDuration(position / speed);
        if (remainingRef.current) {
          remainingRef.current.textContent = formatDuration((engine.maxPosition - position) / speed);
        }
      }
      scheduleNext();
    };
    wakeLoopRef.current = requestSoon;
    requestSoon();
    const onVisibility = () => {
      engineRef.current!.resetClock();
      requestSoon();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLoopRef.current = () => undefined;
    };
  }, []);

  // Once playback is underway, give the controls one second before fading
  // them away. Any setting interaction or open panel restarts the idle period.
  useEffect(() => {
    if (!playing || !controlsVisible || panel !== 'none') return;
    const timer = setTimeout(() => {
      setControlsVisible(false);
    }, PLAYBACK_CONTROLS_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [
    playing,
    controlsVisible,
    panel,
    settings.speed,
    settings.fontSize,
    settings.horizontalMargin,
    controlsActivity
  ]);

  useEffect(() => {
    if (controlsVisible) return;
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      bottomBarRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
  }, [controlsVisible]);

  // Scroll manual táctil + tap para mostrar/ocultar controles.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panel !== 'none') return;
    applyKeepScreenAwake(settingsRef.current.keepScreenAwake);
    dragRef.current = { y: e.clientY, moved: false, startedAt: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    wakeLoopRef.current();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 4) drag.moved = true;
    drag.y = e.clientY;
    const engine = engineRef.current!;
    engine.seek(engine.state.position - dy);
    wakeLoopRef.current();
  };
  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved && performance.now() - drag.startedAt < 400) {
      setControlsVisible((v) => !v);
    }
  };

  const contentStyle = {
    '--prompter-font-size': `${settings.fontSize}px`,
    '--prompter-margin': `${settings.horizontalMargin}%`
  } as CSSProperties;
  const adjustmentStyle = adjustmentFeedback
    ? ({
        '--adjustment-progress': `${adjustmentProgress(
          adjustmentFeedback.key,
          adjustmentFeedback.value
        )}%`
      } as CSSProperties)
    : undefined;

  return (
    <div className={styles.page} data-testid="prompter-page">
      <div
        ref={viewportRef}
        className={styles.viewport}
        data-testid="prompter-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={contentRef} className={styles.content} style={contentStyle} data-testid="prompter-content">
          <div
            role="heading"
            aria-level={1}
            className={`${styles.heading} ${styles.scriptTitleHeading}`}
            data-block-type="script-title"
          >
            {script.title}
          </div>
          {blocks.map((block, index) =>
            block.type === 'heading' ? (
              <div
                key={index}
                ref={(el) => {
                  blockElsRef.current[index] = el;
                }}
                role="heading"
                aria-level={block.level}
                className={styles.heading}
                data-block-type="heading"
              >
                {block.text}
              </div>
            ) : (
              <p
                key={index}
                ref={(el) => {
                  blockElsRef.current[index] = el;
                }}
                className={styles.text}
                data-block-type="text"
              >
                {block.text}
              </p>
            )
          )}
        </div>
      </div>

      {countdown !== null && (
        <div className={styles.countdown} data-testid="startup-countdown" role="status" aria-live="assertive">
          <strong>{countdown}</strong>
          <span>Starting…</span>
        </div>
      )}

      {storageError && (
        <div className={styles.storageError} role="alert">
          <span>{storageError}</span>
          <button type="button" onClick={() => setStorageError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {adjustmentFeedback && (
        <div
          className={`${styles.adjustmentFeedback} ${
            adjustmentFeedback.phase === 'exiting' ? styles.adjustmentFeedbackExiting : ''
          }`}
          style={adjustmentStyle}
          data-testid="adjustment-feedback"
          data-setting={adjustmentFeedback.key}
          data-phase={adjustmentFeedback.phase}
          role="status"
          aria-live="polite"
        >
          <span className={styles.adjustmentLabel}>
            {ADJUSTMENT_DISPLAY[adjustmentFeedback.key].label}
          </span>
          <strong
            className={styles.adjustmentValue}
            data-testid="adjustment-feedback-value"
          >
            <span>{adjustmentFeedback.value}</span>
            {ADJUSTMENT_DISPLAY[adjustmentFeedback.key].unit && (
              <span className={styles.adjustmentUnit}>
                {ADJUSTMENT_DISPLAY[adjustmentFeedback.key].unit}
              </span>
            )}
          </strong>
          <span className={styles.adjustmentMeter} aria-hidden="true" />
        </div>
      )}

      {controlsVisible && !playing && (
          <header className={styles.topBar} data-testid="top-controls">
            <button
              type="button"
              data-testid="back-to-scripts"
              className={styles.iconButton}
              aria-label="Back to scripts"
              onClick={() => exitToScripts(false)}
            >
              <Icon name="back" />
            </button>
            <span className={styles.title}>{script.title}</span>
            <span className={styles.sectionIndicator} data-testid="section-indicator">
              {sectionIdx + 1} / {sections.length}
            </span>
            <span className={styles.visuallyHidden} role="status">
              {gamepadConnected ? 'Controller connected' : 'No controller connected'}
            </span>
            <button
              type="button"
              className={gamepadConnected ? styles.padOn : styles.padOff}
              data-testid="gamepad-status"
              data-connected={gamepadConnected}
              aria-label={gamepadConnected ? 'Controller connected' : 'No controller connected'}
              title={gamepadConnected ? 'Controller connected' : 'No controller'}
              onClick={() => setPanel('controllerGuide')}
            >
              <Icon name={gamepadConnected ? gamepadIconName(padFamily) : 'gamepad'} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              data-testid="edit-script"
              aria-label="Edit script"
              onClick={editScript}
            >
              <Icon name="edit" />
            </button>
          </header>
      )}

      <footer
        ref={bottomBarRef}
        className={`${styles.bottomBar} ${controlsVisible ? '' : styles.bottomBarHidden}`}
        data-testid="bottom-controls"
        data-visible={controlsVisible}
        aria-hidden={!controlsVisible}
        onPointerDown={() => setControlsActivity((activity) => activity + 1)}
        onFocus={() => setControlsActivity((activity) => activity + 1)}
      >
            <div className={styles.controlMetaRow}>
              <p
                className={styles.timeEstimate}
                title="Estimated reading time at the current speed"
                aria-label="Estimated elapsed and remaining reading time"
              >
                <span ref={elapsedRef} className={styles.elapsedTime}>00:00</span>
                <span className={styles.timeSeparator} aria-hidden="true">/</span>
                <span ref={remainingRef} className={styles.remainingTime}>--:--</span>
              </p>
            </div>
            <div className={styles.speedRow}>
              <span className={styles.speedLabel}>Speed</span>
              <input
                type="range"
                data-testid="speed-quick-slider"
                min={SPEED_LIMITS.min}
                max={SPEED_LIMITS.max}
                step={SPEED_LIMITS.step}
                value={settings.speed}
                onChange={(e) => updateSetting('speed', Number(e.target.value))}
                aria-label="Speed"
              />
              <span className={styles.speedValue} data-testid="speed-quick-value">
                {settings.speed}
              </span>
            </div>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="reset-position"
                aria-label="Back to start"
                onClick={resetToStart}
              >
                <Icon name="reset" />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="section-prev"
                aria-label="Previous section"
                onClick={() => applyAction('prevSection')}
              >
                <Icon name="previousSection" />
              </button>
              <button
                type="button"
                className={styles.playButton}
                data-testid="play-pause"
                data-playing={playing}
                data-counting={countdown !== null}
                onClick={togglePlay}
              >
                <Icon name={playing || countdown !== null ? 'pause' : 'play'} />
                {countdown !== null ? 'CANCEL' : playing ? 'PAUSE' : 'START'}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="section-next"
                aria-label="Next section"
                onClick={() => applyAction('nextSection')}
              >
                <Icon name="nextSection" />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="sections-toggle"
                aria-label="Sections"
                onClick={() => setPanel((p) => (p === 'sections' ? 'none' : 'sections'))}
              >
                <Icon name="list" />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="settings-toggle"
                aria-label="Settings"
                onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))}
              >
                <Icon name="settings" />
              </button>
            </div>
      </footer>

      {panel === 'settings' && (
        <SettingsPanel
          settings={settings}
          onChange={updateSetting}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'sections' && (
        <SectionNav
          sections={sections}
          currentIndex={sectionIdx}
          onSelect={(idx) => {
            jumpToSection(idx);
            setPanel('none');
          }}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'controllerGuide' && (
        <ControllerGuide
          bindings={settings.controllerBindings}
          family={padFamily}
          connected={gamepadConnected}
          onClose={() => setPanel('none')}
        />
      )}
    </div>
  );
}
