import type { PrompterSettings } from '../../types';
import {
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS,
  type Limit
} from '../../features/settings/settings';
import styles from './PrompterPage.module.css';

type SettingKey = 'speed' | 'fontSize' | 'horizontalMargin';

function SettingRow({
  label,
  testId,
  value,
  limit,
  unit,
  onChange
}: {
  label: string;
  testId: string;
  value: number;
  limit: Limit;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.settingLabel}>{label}</span>
      <button
        type="button"
        className={styles.stepButton}
        data-testid={`${testId}-minus`}
        aria-label={`Reducir ${label}`}
        onClick={() => onChange(value - limit.step)}
      >
        −
      </button>
      <input
        type="range"
        data-testid={`${testId}-slider`}
        min={limit.min}
        max={limit.max}
        step={limit.step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <button
        type="button"
        className={styles.stepButton}
        data-testid={`${testId}-plus`}
        aria-label={`Aumentar ${label}`}
        onClick={() => onChange(value + limit.step)}
      >
        +
      </button>
      <span className={styles.settingValue} data-testid={`${testId}-value`}>
        {value}
        {unit}
      </span>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onChange,
  onOpenMapping,
  onClose
}: {
  settings: PrompterSettings;
  onChange: (key: SettingKey, value: number) => void;
  onOpenMapping: () => void;
  onClose: () => void;
}) {
  return (
    <div className={styles.panelBackdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Ajustes"
        data-testid="settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <SettingRow
          label="Velocidad"
          testId="speed"
          value={settings.speed}
          limit={SPEED_LIMITS}
          unit=""
          onChange={(v) => onChange('speed', v)}
        />
        <SettingRow
          label="Tamaño"
          testId="font"
          value={settings.fontSize}
          limit={FONT_LIMITS}
          unit="px"
          onChange={(v) => onChange('fontSize', v)}
        />
        <SettingRow
          label="Márgenes"
          testId="margin"
          value={settings.horizontalMargin}
          limit={MARGIN_LIMITS}
          unit="%"
          onChange={(v) => onChange('horizontalMargin', v)}
        />
        <div className={styles.panelActions}>
          <button type="button" data-testid="open-mapping" onClick={onOpenMapping}>
            Mando…
          </button>
          <button type="button" data-testid="settings-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
