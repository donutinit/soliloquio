import type { PrompterSettings } from '../../types';
import {
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS,
  type Limit
} from '../../features/settings/settings';
import { useModalFocus } from '../../app/useModalFocus';
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
        aria-label={`Decrease ${label}`}
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
        aria-label={`Increase ${label}`}
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
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  return (
    <div className={styles.panelBackdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        data-testid="settings-panel"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title" className={styles.panelTitle}>Settings</h2>
        <SettingRow
          label="Speed"
          testId="speed"
          value={settings.speed}
          limit={SPEED_LIMITS}
          unit=""
          onChange={(v) => onChange('speed', v)}
        />
        <SettingRow
          label="Text size"
          testId="font"
          value={settings.fontSize}
          limit={FONT_LIMITS}
          unit="px"
          onChange={(v) => onChange('fontSize', v)}
        />
        <SettingRow
          label="Margins"
          testId="margin"
          value={settings.horizontalMargin}
          limit={MARGIN_LIMITS}
          unit="%"
          onChange={(v) => onChange('horizontalMargin', v)}
        />
        <div className={styles.panelActions}>
          <button type="button" data-testid="open-mapping" onClick={onOpenMapping}>
            Controller…
          </button>
          <button type="button" data-testid="settings-close" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
