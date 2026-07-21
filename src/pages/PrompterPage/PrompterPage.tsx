import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { PrompterSettings, Script } from '../../types';
import { getScript, getSettings, savePosition, saveSettings } from '../../services/database';
import { scriptToBlocks } from '../../features/markdown/flatten';
import { buildSections, currentSectionIndex, stepSection } from '../../features/sections/sections';
import { ScrollEngine } from '../../features/prompter/scrollEngine';
import { GamepadController, getActiveGamepad, type GamepadAction } from '../../features/gamepad/controller';
import {
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS,
  clampToLimit
} from '../../features/settings/settings';
import { createWakeLock } from '../../services/wakeLock';
import { SettingsPanel } from './SettingsPanel';
import { SectionNav } from './SectionNav';
import { MappingEditor } from './MappingEditor';
import styles from './PrompterPage.module.css';

/** Línea de lectura: fracción del alto del viewport donde se considera que se lee. */
const READING_LINE_FRACTION = 0.4;
const TOAST_MS = 1500;
const POSITION_SAVE_INTERVAL_MS = 2000;

type Panel = 'none' | 'settings' | 'sections' | 'mapping';

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

  useEffect(() => {
    void Promise.all([getScript(scriptId), getSettings()]).then(([loadedScript, loadedSettings]) => {
      if (!loadedScript) {
        setMissing(true);
        return;
      }
      setScript(loadedScript);
      setSettings(loadedSettings);
    });
  }, [scriptId]);

  if (missing) {
    return (
      <div className={styles.missing}>
        <p>Este guion ya no existe.</p>
        <button type="button" onClick={() => navigate('#/')}>
          Volver a guiones
        </button>
      </div>
    );
  }

  if (!script || !settings) return null;

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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [panel, setPanel] = useState<Panel>('none');
  const [sectionIdx, setSectionIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [gamepadConnected, setGamepadConnected] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const blockElsRef = useRef<(HTMLElement | null)[]>([]);
  const sectionOffsetsRef = useRef<number[]>([]);
  const sectionIdxRef = useRef(0);
  const panelRef = useRef<Panel>('none');
  panelRef.current = panel;
  const gamepadConnectedRef = useRef(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedPositionRef = useRef(script.lastPosition ?? 0);
  const dragRef = useRef<{ y: number; moved: boolean; startedAt: number } | null>(null);

  const engineRef = useRef<ScrollEngine | null>(null);
  if (!engineRef.current) {
    const engine = new ScrollEngine();
    engine.state.baseSpeed = initialSettings.speed;
    engine.state.position = script.lastPosition ?? 0;
    engineRef.current = engine;
  }
  const controllerRef = useRef<GamepadController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new GamepadController(initialSettings.controllerMapping);
  }

  useEffect(() => {
    engineRef.current!.state.baseSpeed = settings.speed;
  }, [settings.speed]);

  useEffect(() => {
    controllerRef.current!.setMapping(settings.controllerMapping);
  }, [settings.controllerMapping]);

  // Persistencia de ajustes con debounce.
  useEffect(() => {
    if (settings === initialSettings) return;
    const timer = setTimeout(() => void saveSettings(settings), 400);
    return () => clearTimeout(timer);
  }, [settings, initialSettings]);

  const showSectionToast = useCallback(
    (idx: number) => {
      const title = sections[idx]?.title || `Sección ${idx + 1}`;
      setToast(title);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), TOAST_MS);
    },
    [sections]
  );

  const jumpToSection = useCallback(
    (idx: number) => {
      const target = stepSection(idx, 0, sections.length);
      // Salto directo, sin animación larga; conserva play/pause y velocidad.
      engineRef.current!.seek(sectionOffsetsRef.current[target] ?? 0);
      sectionIdxRef.current = target;
      setSectionIdx(target);
      showSectionToast(target);
    },
    [sections.length, showSectionToast]
  );

  const togglePlay = useCallback(() => {
    const engine = engineRef.current!;
    engine.state.playing = !engine.state.playing;
    setPlaying(engine.state.playing);
  }, []);

  const exitToScripts = useCallback(() => {
    void savePosition(script.id, engineRef.current!.state.position).finally(() =>
      navigate('#/')
    );
  }, [script.id, navigate]);

  const updateSetting = useCallback((key: 'speed' | 'fontSize' | 'horizontalMargin', value: number) => {
    const limit =
      key === 'speed' ? SPEED_LIMITS : key === 'fontSize' ? FONT_LIMITS : MARGIN_LIMITS;
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
          engineRef.current!.seek(0);
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
    [togglePlay, exitToScripts, jumpToSection, updateSetting, sections.length]
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

  // Bucle principal: gamepad + motor de scroll + detección de sección, sin
  // re-render de React por frame (transform directo sobre el DOM).
  useEffect(() => {
    let rafId = 0;
    const loop = (now: number) => {
      const engine = engineRef.current!;
      const frame = controllerRef.current!.update(getActiveGamepad(), now);
      if (frame.connected !== gamepadConnectedRef.current) {
        gamepadConnectedRef.current = frame.connected;
        setGamepadConnected(frame.connected);
      }
      // Mientras se edita el mapeo, los botones no disparan acciones.
      if (panelRef.current !== 'mapping') {
        for (const action of frame.actions) applyActionRef.current(action);
        const direction = Math.sign(frame.manualVelocity) as -1 | 0 | 1;
        engine.setManual(direction, Math.abs(frame.manualVelocity));
      } else {
        engine.setManual(0, 0);
      }
      const position = engine.tick(now);
      if (contentRef.current) {
        contentRef.current.style.transform = `translate3d(0, ${-position}px, 0)`;
      }
      const readingLine = (viewportRef.current?.clientHeight ?? 0) * READING_LINE_FRACTION;
      const idx = currentSectionIndex(sectionOffsetsRef.current, position, readingLine);
      if (idx !== sectionIdxRef.current) {
        sectionIdxRef.current = idx;
        setSectionIdx(idx);
        showSectionToast(idx);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    const onVisibility = () => engineRef.current!.resetClock();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
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

  // Pantalla siempre encendida mientras el prompter está abierto.
  useEffect(() => {
    const wakeLock = createWakeLock();
    void wakeLock.acquire();
    return () => wakeLock.destroy();
  }, []);

  // Scroll manual táctil + tap para mostrar/ocultar controles.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panel !== 'none') return;
    dragRef.current = { y: e.clientY, moved: false, startedAt: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 4) drag.moved = true;
    drag.y = e.clientY;
    const engine = engineRef.current!;
    engine.seek(engine.state.position - dy);
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

      {controlsVisible && (
        <>
          <header className={styles.topBar}>
            <button
              type="button"
              data-testid="back-to-scripts"
              className={styles.iconButton}
              onClick={exitToScripts}
            >
              ‹
            </button>
            <span className={styles.title}>{script.title}</span>
            <span className={styles.sectionIndicator} data-testid="section-indicator">
              {sectionIdx + 1} / {sections.length}
            </span>
            <span
              className={gamepadConnected ? styles.padOn : styles.padOff}
              data-testid="gamepad-status"
              data-connected={gamepadConnected}
              title={gamepadConnected ? 'Mando conectado' : 'Sin mando'}
            >
              ●
            </span>
          </header>

          <footer className={styles.bottomBar}>
            {!gamepadConnected && (
              <p className={styles.padHint}>Mando: conéctalo y presiona un botón para activarlo</p>
            )}
            <div className={styles.speedRow}>
              <span aria-hidden="true">–</span>
              <input
                type="range"
                data-testid="speed-quick-slider"
                min={SPEED_LIMITS.min}
                max={SPEED_LIMITS.max}
                step={SPEED_LIMITS.step}
                value={settings.speed}
                onChange={(e) => updateSetting('speed', Number(e.target.value))}
                aria-label="Velocidad"
              />
              <span aria-hidden="true">+</span>
              <span className={styles.speedValue} data-testid="speed-quick-value">
                {settings.speed}
              </span>
            </div>
            <div className={styles.buttonRow}>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="reset-position"
                aria-label="Volver al inicio"
                onClick={() => engineRef.current!.seek(0)}
              >
                ⏮
              </button>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="section-prev"
                aria-label="Sección anterior"
                onClick={() => applyAction('prevSection')}
              >
                ↑§
              </button>
              <button
                type="button"
                className={styles.playButton}
                data-testid="play-pause"
                data-playing={playing}
                onClick={togglePlay}
              >
                {playing ? 'PAUSA' : 'INICIAR'}
              </button>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="section-next"
                aria-label="Sección siguiente"
                onClick={() => applyAction('nextSection')}
              >
                ↓§
              </button>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="sections-toggle"
                aria-label="Secciones"
                onClick={() => setPanel((p) => (p === 'sections' ? 'none' : 'sections'))}
              >
                ☰
              </button>
              <button
                type="button"
                className={styles.iconButton}
                data-testid="settings-toggle"
                aria-label="Ajustes"
                onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))}
              >
                ⚙
              </button>
            </div>
          </footer>
        </>
      )}

      {panel === 'settings' && (
        <SettingsPanel
          settings={settings}
          onChange={updateSetting}
          onOpenMapping={() => setPanel('mapping')}
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
      {panel === 'mapping' && (
        <MappingEditor
          mapping={settings.controllerMapping}
          onChange={(mapping) => setSettingsState((prev) => ({ ...prev, controllerMapping: mapping }))}
          onClose={() => setPanel('settings')}
        />
      )}
    </div>
  );
}
