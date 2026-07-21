import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { PrompterSettings, Script } from '../../types';
import { getScript, getSettings, savePosition, saveSettings } from '../../services/database';
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
import { editorHash } from '../../app/router';
import { Icon } from '../../components/Icon';
import styles from './PrompterPage.module.css';

/** Línea de lectura: fracción del alto del viewport donde se considera que se lee. */
const READING_LINE_FRACTION = 0.4;
const TOAST_MS = 1500;
const POSITION_SAVE_INTERVAL_MS = 2000;
const IDLE_POLL_INTERVAL_MS = 250;

type Panel = 'none' | 'settings' | 'sections';

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
  navigate
}: {
  scriptId: string;
  navigate: (hash: string) => void;
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

  return <Prompter script={script} initialSettings={settings} navigate={navigate} />;
}

function Prompter({
  script,
  initialSettings,
  navigate
}: {
  script: Script;
  initialSettings: PrompterSettings;
  navigate: (hash: string) => void;
}) {
  const blocks = useMemo(() => scriptToBlocks(script), [script]);
  const sections = useMemo(() => buildSections(blocks), [blocks]);

  const [settings, setSettingsState] = useState(initialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [playing, setPlaying] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [panel, setPanel] = useState<Panel>('none');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [padFamily, setPadFamily] = useState<ControllerFamily>('generic');
  const [storageError, setStorageError] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const blockElsRef = useRef<(HTMLElement | null)[]>([]);
  const sectionOffsetsRef = useRef<number[]>([]);
  const sectionIdxRef = useRef(0);
  const panelRef = useRef<Panel>('none');
  panelRef.current = panel;
  const gamepadConnectedRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<number | null>(null);
  const hasStartedRef = useRef(false);
  const lastSavedPositionRef = useRef(script.lastPosition ?? 0);
  const dragRef = useRef<{ y: number; moved: boolean; startedAt: number } | null>(null);
  const settingsDirtyRef = useRef(false);
  const settingsSaveRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const wakeLoopRef = useRef<() => void>(() => undefined);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const lastTimeDisplayRef = useRef('');
  const renderedPositionRef = useRef(Number.NaN);
  const exitingRef = useRef(false);

  const engineRef = useRef<ScrollEngine | null>(null);
  if (!engineRef.current) {
    const engine = new ScrollEngine();
    engine.state.baseSpeed = initialSettings.speed;
    engine.state.position = script.lastPosition ?? 0;
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

  const showSectionToast = useCallback(
    (idx: number) => {
      const title = sections[idx]?.title || `Section ${idx + 1}`;
      setToast(title);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS);
    },
    [sections]
  );

  const jumpToSection = useCallback(
    (idx: number) => {
      const target = stepSection(idx, 0, sections.length);
      const readingLine = (viewportRef.current?.clientHeight ?? 0) * READING_LINE_FRACTION;
      // Place the section heading on the reading line instead of under the top controls.
      engineRef.current!.seek((sectionOffsetsRef.current[target] ?? 0) - readingLine);
      sectionIdxRef.current = target;
      setSectionIdx(target);
      showSectionToast(target);
      wakeLoopRef.current();
    },
    [sections.length, showSectionToast]
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
    wakeLoopRef.current();
  }, [clearCountdown]);

  const togglePlay = useCallback(() => {
    if (countdownRef.current !== null) {
      clearCountdown();
      return;
    }

    const engine = engineRef.current!;
    if (engine.state.playing) {
      engine.state.playing = false;
      setPlaying(false);
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
    },
    []
  );

  const exitToScripts = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    void Promise.allSettled([
      savePosition(script.id, engineRef.current!.state.position),
      persistSettings()
    ]).finally(() => navigate('#/'));
  }, [script.id, navigate, persistSettings]);

  const editScript = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    void Promise.allSettled([
      savePosition(script.id, engineRef.current!.state.position),
      persistSettings()
    ]).finally(() => navigate(editorHash(script.id)));
  }, [navigate, persistSettings, script.id]);

  const updateSetting = useCallback((key: 'speed' | 'fontSize' | 'horizontalMargin', value: number) => {
    const limit =
      key === 'speed' ? SPEED_LIMITS : key === 'fontSize' ? FONT_LIMITS : MARGIN_LIMITS;
    settingsDirtyRef.current = true;
    setSettingsState((prev) => ({ ...prev, [key]: clampToLimit(value, limit) }));
  }, []);

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
          exitToScripts();
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
      if (frame.connected !== gamepadConnectedRef.current) {
        gamepadConnectedRef.current = frame.connected;
        setGamepadConnected(frame.connected);
        setPadFamily(pad ? identifyController(pad.id).family : 'generic');
      }
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
      }
      const readingLine = (viewportRef.current?.clientHeight ?? 0) * READING_LINE_FRACTION;
      const idx = currentSectionIndex(sectionOffsetsRef.current, position, readingLine);
      if (idx !== sectionIdxRef.current) {
        sectionIdxRef.current = idx;
        setSectionIdx(idx);
        showSectionToast(idx);
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
  }, [showSectionToast]);

  // Guardado periódico de la posición + al salir.
  useEffect(() => {
    const save = () => {
      const position = engineRef.current!.state.position;
      if (Math.abs(position - lastSavedPositionRef.current) > 1) {
        lastSavedPositionRef.current = position;
        void savePosition(script.id, position);
      }
    };
    const interval = setInterval(save, POSITION_SAVE_INTERVAL_MS);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [script.id]);


  // Scroll manual táctil + tap para mostrar/ocultar controles.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panel !== 'none') return;
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

  return (
    <div className={styles.page} data-testid="prompter-page">
      <div
        ref={viewportRef}
        className={styles.viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={contentRef} className={styles.content} style={contentStyle} data-testid="prompter-content">
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

      {toast && (
        <div className={styles.toast} data-testid="section-toast" role="status">
          {toast}
        </div>
      )}

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

      {controlsVisible && (
        <>
          <header className={styles.topBar}>
            <button
              type="button"
              data-testid="back-to-scripts"
              className={styles.iconButton}
              aria-label="Back to scripts"
              onClick={exitToScripts}
            >
              <Icon name="back" />
            </button>
            <span className={styles.title}>{script.title}</span>
            <span className={styles.sectionIndicator} data-testid="section-indicator">
              {sectionIdx + 1} / {sections.length}
            </span>
            <span
              className={gamepadConnected ? styles.padOn : styles.padOff}
              data-testid="gamepad-status"
              data-connected={gamepadConnected}
              role="status"
              aria-label={gamepadConnected ? 'Controller connected' : 'No controller connected'}
              title={gamepadConnected ? 'Controller connected' : 'No controller'}
            >
              <Icon name={gamepadConnected ? gamepadIconName(padFamily) : 'gamepad'} />
            </span>
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

          <footer className={styles.bottomBar} data-testid="bottom-controls">
            <div className={styles.controlMetaRow}>
              {!gamepadConnected && (
                <p className={styles.padHint}>Connect a controller and press any button to activate it</p>
              )}
              <p
                className={styles.timeEstimate}
                title="Estimated reading time at the current speed"
                aria-label="Estimated elapsed and remaining reading time"
              >
                <span className={styles.elapsedTime}>E <span ref={elapsedRef}>00:00</span></span>
                <span className={styles.remainingTime}>R <span ref={remainingRef}>--:--</span></span>
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
        </>
      )}

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
    </div>
  );
}
