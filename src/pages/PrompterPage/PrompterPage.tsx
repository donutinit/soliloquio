import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PrompterSettings, Script } from '../../types';
import { getScript, getSettings } from '../../services/database';
import { applyKeepScreenAwake } from '../../services/keepAwake';
import { getActiveGamepad } from '../../services/gamepads';
import { scriptToBlocks } from '../../features/markdown/flatten';
import { buildSections, currentSectionIndex, stepSection } from '../../features/sections/sections';
import { ScrollEngine } from '../../features/prompter/scrollEngine';
import { GamepadController, type GamepadAction } from '../../features/gamepad/controller';
import {
  gamepadIconName,
  identifyController,
  is8BitDoMicro,
  is8BitDoPro3,
  type ControllerFamily
} from '../../features/gamepad/controllerIdentity';
import {
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS
} from '../../features/settings/settings';
import { SettingsPanel } from './SettingsPanel';
import { SectionNav } from './SectionNav';
import { ControllerGuide } from './ControllerGuide';
import { ReadingSurface } from './ReadingSurface';
import { AdjustmentFeedbackToast } from './AdjustmentFeedbackToast';
import { usePrompterSettings } from './usePrompterSettings';
import { usePlaybackControls } from './usePlaybackControls';
import { usePrompterKeyboard } from './usePrompterKeyboard';
import { formatDuration } from './prompterDisplay';
import type { Panel } from './usePrompterKeyboard';
import { editorHash } from '../../app/router';
import { Icon } from '../../components/Icon';
import { cssVars } from '../../styles/cssVars';
import styles from './PrompterPage.module.css';

/** Línea de lectura: fracción del alto del viewport donde se considera que se lee. */
const READING_LINE_FRACTION = 0.4;
const IDLE_POLL_INTERVAL_MS = 250;
const PLAYBACK_CONTROLS_AUTO_HIDE_MS = 1000;

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

  const {
    settings,
    settingsRef,
    updateSetting,
    persistSettings,
    storageError,
    dismissStorageError,
    adjustmentFeedback
  } = usePrompterSettings(initialSettings);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsActivity, setControlsActivity] = useState(0);
  const [panel, setPanel] = useState<Panel>('none');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [gamepadConnected, setGamepadConnected] = useState(false);
  const [padFamily, setPadFamily] = useState<ControllerFamily>('playstation');
  const [padModel, setPadModel] = useState<'micro' | 'pro3' | null>(null);
  const [contentFits, setContentFits] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLElement>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const blockElsRef = useRef<(HTMLElement | null)[]>([]);
  const sectionOffsetsRef = useRef<number[]>([]);
  const sectionIdxRef = useRef(0);
  const panelRef = useRef<Panel>('none');
  panelRef.current = panel;
  const previousPanelRef = useRef<Panel>('none');
  const gamepadConnectedRef = useRef(false);
  const padIdRef = useRef<string | null>(null);
  const dragRef = useRef<{ y: number; moved: boolean; startedAt: number } | null>(null);
  const wakeLoopRef = useRef<() => void>(() => undefined);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const lastTimeDisplayRef = useRef('');
  const renderedPositionRef = useRef(Number.NaN);
  const exitingRef = useRef(false);
  const manualWakeActiveRef = useRef(false);

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

  const requireEngine = useCallback((): ScrollEngine => {
    const engine = engineRef.current;
    if (!engine) throw new Error('Scroll engine is not initialized');
    return engine;
  }, []);
  const requireController = useCallback((): GamepadController => {
    const controller = controllerRef.current;
    if (!controller) throw new Error('Gamepad controller is not initialized');
    return controller;
  }, []);

  const revealControls = useCallback(() => setControlsVisible(true), []);

  const { playing, setPlaying, countdown, togglePlay, resetToStart } = usePlaybackControls({
    requireEngine,
    settingsRef,
    wakeLoopRef,
    revealControls
  });
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  useEffect(() => {
    requireEngine().state.baseSpeed = settings.speed;
  }, [settings.speed, requireEngine]);

  useEffect(() => {
    requireController().setBindings(settings.controllerBindings);
  }, [settings.controllerBindings, requireController]);

  // Al cerrar un panel, descarta la pulsación que lo cerró: su release ya no
  // debe disparar la acción del lector asignada a ese botón. La ejecución
  // inicial no cuenta como cierre, para poder aceptar un mando conectado aquí.
  useEffect(() => {
    if (previousPanelRef.current !== 'none' && panel === 'none') {
      requireController().reset();
    }
    previousPanelRef.current = panel;
  }, [panel, requireController]);

  const jumpToSection = useCallback(
    (idx: number) => {
      const target = stepSection(idx, 0, sections.length);
      const readingLine = (viewportRef.current?.clientHeight ?? 0) * READING_LINE_FRACTION;
      // Place the section heading on the reading line instead of under the top controls.
      requireEngine().seek((sectionOffsetsRef.current[target] ?? 0) - readingLine);
      sectionIdxRef.current = target;
      setSectionIdx(target);
      wakeLoopRef.current();
    },
    [sections.length, requireEngine]
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

  const applyAction = useCallback(
    (action: GamepadAction) => {
      const current = settingsRef.current;
      switch (action) {
        case 'togglePlay':
          togglePlay(false);
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
          updateSetting('speed', current.speed - SPEED_LIMITS.step, true);
          break;
        case 'speedUp':
          updateSetting('speed', current.speed + SPEED_LIMITS.step, true);
          break;
        case 'fontUp':
          updateSetting('fontSize', current.fontSize + FONT_LIMITS.step, true);
          break;
        case 'fontDown':
          updateSetting('fontSize', current.fontSize - FONT_LIMITS.step, true);
          break;
        case 'marginUp':
          updateSetting('horizontalMargin', current.horizontalMargin + MARGIN_LIMITS.step, true);
          break;
        case 'marginDown':
          updateSetting('horizontalMargin', current.horizontalMargin - MARGIN_LIMITS.step, true);
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
      const maxPosition = content.scrollHeight - viewport.clientHeight;
      requireEngine().setMaxPosition(maxPosition);
      setContentFits(maxPosition <= 0);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [sections, blocks, requireEngine]);

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
      const engine = requireEngine();
      if (
        engine.state.playing ||
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
      const engine = requireEngine();
      const pad = getActiveGamepad();
      const frame = requireController().update(pad, now);
      const padId = pad?.id ?? null;
      if (padId !== padIdRef.current) {
        padIdRef.current = padId;
        if (pad) {
          setPadFamily(identifyController(pad.id).family);
          setPadModel(
            is8BitDoMicro(pad.id) ? 'micro' : is8BitDoPro3(pad.id) ? 'pro3' : null
          );
        }
      }
      if (frame.connected !== gamepadConnectedRef.current) {
        gamepadConnectedRef.current = frame.connected;
        setGamepadConnected(frame.connected);
      }
      const inputEnabled = panelRef.current === 'none';
      const temporarySpeedMultiplier = inputEnabled ? frame.temporarySpeedMultiplier : 1;
      engine.state.temporarySpeedMultiplier = temporarySpeedMultiplier;
      const multiplierVelocity =
        inputEnabled && !engine.state.playing && temporarySpeedMultiplier !== 1
          ? settingsRef.current.speed * temporarySpeedMultiplier
          : 0;
      const manualVelocity = inputEnabled ? frame.manualVelocity + multiplierVelocity : 0;
      const manualWakeActive = Math.abs(manualVelocity) > 0;
      if (manualWakeActive && !manualWakeActiveRef.current) {
        applyKeepScreenAwake(settingsRef.current.keepScreenAwake);
      }
      manualWakeActiveRef.current = manualWakeActive;
      // Con un panel abierto, el mando navega el panel (hook global): las
      // acciones del lector y el scroll manual quedan suspendidos.
      if (inputEnabled) {
        for (const action of frame.actions) applyActionRef.current(action);
        const direction: -1 | 0 | 1 =
          manualVelocity > 0 ? 1 : manualVelocity < 0 ? -1 : 0;
        engine.setManual(direction, Math.abs(manualVelocity));
      } else {
        if (
          panelRef.current === 'sections' &&
          pad !== null &&
          is8BitDoMicro(pad.id) &&
          frame.actions.includes('toggleSections')
        ) {
          applyActionRef.current('toggleSections');
        }
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
      const timeDisplay = `${Math.round(position)}:${Math.round(engine.maxPosition)}:${settingsRef.current.speed}:${engine.state.temporarySpeedMultiplier}`;
      if (timeDisplay !== lastTimeDisplayRef.current) {
        lastTimeDisplayRef.current = timeDisplay;
        const effectiveSpeed = settingsRef.current.speed * engine.state.temporarySpeedMultiplier;
        if (elapsedRef.current) elapsedRef.current.textContent = formatDuration(position / effectiveSpeed);
        if (remainingRef.current) {
          remainingRef.current.textContent = formatDuration(
            (engine.maxPosition - position) / effectiveSpeed
          );
        }
      }
      scheduleNext();
    };
    wakeLoopRef.current = requestSoon;
    requestSoon();
    const onGamepadConnected = () => {
      requireController().acceptNextConnectionInput();
      requestSoon();
    };
    const onVisibility = () => {
      requireEngine().resetClock();
      requestSoon();
    };
    window.addEventListener('gamepadconnected', onGamepadConnected);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLoopRef.current = () => undefined;
    };
  }, [requireEngine, requireController, setPlaying, settingsRef]);

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

  usePrompterKeyboard({ panelRef, togglePlayRef, playButtonRef, revealControls });

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
    const engine = requireEngine();
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

  const contentStyle = cssVars({
    '--prompter-font-size': `${settings.fontSize}px`,
    '--prompter-margin': `${settings.horizontalMargin}%`
  });

  return (
    <main className={styles.page} data-testid="prompter-page">
      <div
        ref={viewportRef}
        className={styles.viewport}
        data-testid="prompter-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <ReadingSurface
          title={script.title}
          blocks={blocks}
          contentStyle={contentStyle}
          contentRef={contentRef}
          blockElsRef={blockElsRef}
        />
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
          <button type="button" onClick={dismissStorageError}>
            Dismiss
          </button>
        </div>
      )}

      {adjustmentFeedback && <AdjustmentFeedbackToast feedback={adjustmentFeedback} />}

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
                ref={playButtonRef}
                className={styles.playButton}
                data-testid="play-pause"
                data-playing={playing}
                data-counting={countdown !== null}
                disabled={contentFits && countdown === null}
                title={contentFits ? 'This script fits on the screen' : undefined}
                onClick={() => togglePlay(true)}
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
          micro={padModel === 'micro'}
          pro3={padModel === 'pro3'}
          connected={gamepadConnected}
          onClose={() => setPanel('none')}
        />
      )}
    </main>
  );
}
