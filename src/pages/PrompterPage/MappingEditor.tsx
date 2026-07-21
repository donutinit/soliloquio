import { useEffect, useState } from 'react';
import { DEFAULT_DUALSHOCK_MAPPING, type ControllerButton, type ControllerMapping } from '../../types';
import { getActiveGamepad } from '../../features/gamepad/controller';
import styles from './PrompterPage.module.css';

const BUTTON_LABELS: Record<ControllerButton, string> = {
  cross: 'Cross (play/pausa · mantener: bajar)',
  circle: 'Circle (volver a guiones)',
  square: 'Square (mostrar/ocultar controles)',
  triangle: 'Triangle (inicio · mantener: subir)',
  l1: 'L1 (sección anterior)',
  r1: 'R1 (sección siguiente)',
  l2: 'L2 (−velocidad · mantener: subir)',
  r2: 'R2 (+velocidad · mantener: bajar)',
  share: 'Share (secciones)',
  options: 'Options (ajustes)',
  leftStickButton: 'Stick izquierdo (botón)',
  rightStickButton: 'Stick derecho (botón)',
  dpadUp: 'D-pad ↑ (+fuente)',
  dpadDown: 'D-pad ↓ (−fuente)',
  dpadLeft: 'D-pad ← (−márgenes)',
  dpadRight: 'D-pad → (+márgenes)',
  ps: 'Botón PS',
  touchpad: 'Touchpad'
};

const BUTTON_NAMES = Object.keys(DEFAULT_DUALSHOCK_MAPPING) as ControllerButton[];

type Diagnostics = { buttons: { pressed: boolean; value: number }[]; axes: number[] } | null;

export function MappingEditor({
  mapping,
  onChange,
  onClose
}: {
  mapping: ControllerMapping;
  onChange: (mapping: ControllerMapping) => void;
  onClose: () => void;
}) {
  const [listening, setListening] = useState<ControllerButton | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>(null);

  // Al reasignar: el siguiente botón que se pulse queda asignado a la acción.
  useEffect(() => {
    if (!listening) return;
    const interval = setInterval(() => {
      const pad = getActiveGamepad();
      if (!pad) return;
      const index = pad.buttons.findIndex((b) => b.pressed || b.value > 0.5);
      if (index >= 0) {
        onChange({ ...mapping, [listening]: index });
        setListening(null);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [listening, mapping, onChange]);

  // Modo diagnóstico: estado crudo de botones y ejes.
  useEffect(() => {
    if (!showDiagnostics) {
      setDiagnostics(null);
      return;
    }
    const interval = setInterval(() => {
      const pad = getActiveGamepad();
      setDiagnostics(
        pad
          ? {
              buttons: pad.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
              axes: [...pad.axes]
            }
          : null
      );
    }, 100);
    return () => clearInterval(interval);
  }, [showDiagnostics]);

  return (
    <div className={styles.mappingOverlay} role="dialog" aria-label="Mapeo del mando" data-testid="mapping-editor">
      <header className={styles.mappingHeader}>
        <h2>Mapeo del mando</h2>
        <button type="button" data-testid="mapping-close" onClick={onClose}>
          Listo
        </button>
      </header>
      <p className={styles.mappingHint}>
        {listening
          ? `Presiona un botón del mando para asignar «${BUTTON_LABELS[listening]}»…`
          : 'Toca una acción y luego presiona el botón del mando que quieras usar. El orden de botones puede variar según el navegador.'}
      </p>
      <ul className={styles.mappingList}>
        {BUTTON_NAMES.map((name) => (
          <li key={name}>
            <button
              type="button"
              data-testid={`map-${name}`}
              className={listening === name ? styles.mappingListening : undefined}
              onClick={() => setListening((current) => (current === name ? null : name))}
            >
              <span>{BUTTON_LABELS[name]}</span>
              <span className={styles.mappingIndex}>botón {mapping[name]}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.panelActions}>
        <button
          type="button"
          data-testid="mapping-reset"
          onClick={() => onChange({ ...DEFAULT_DUALSHOCK_MAPPING })}
        >
          Restablecer
        </button>
        <button type="button" data-testid="diagnostics-toggle" onClick={() => setShowDiagnostics((v) => !v)}>
          {showDiagnostics ? 'Ocultar diagnóstico' : 'Diagnóstico'}
        </button>
      </div>
      {showDiagnostics && (
        <div className={styles.diagnostics} data-testid="diagnostics">
          {diagnostics ? (
            <>
              <p>
                Botones:{' '}
                {diagnostics.buttons
                  .map((b, i) => `${i}:${b.pressed ? '■' : '·'}${b.value > 0 ? b.value.toFixed(2) : ''}`)
                  .join(' ')}
              </p>
              <p>Ejes: {diagnostics.axes.map((a, i) => `${i}:${a.toFixed(2)}`).join(' ')}</p>
            </>
          ) : (
            <p>Sin mando activo. Conéctalo y presiona un botón.</p>
          )}
        </div>
      )}
    </div>
  );
}
