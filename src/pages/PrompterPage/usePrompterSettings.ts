import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrompterSettings } from '../../types';
import { saveSettings } from '../../services/database';
import { registerPendingSaveFlush } from '../../services/pendingSaves';
import {
  FONT_LIMITS,
  MARGIN_LIMITS,
  SPEED_LIMITS,
  clampToLimit
} from '../../features/settings/settings';
import {
  ADJUSTMENT_FEEDBACK_EXIT_MS,
  ADJUSTMENT_FEEDBACK_HOLD_MS,
  type AdjustableSetting,
  type AdjustmentFeedback
} from './prompterDisplay';

/**
 * Ciclo de vida de los ajustes del lector: estado, persistencia diferida,
 * registro en el coordinador de guardados pendientes y avisos de ajuste.
 */
export function usePrompterSettings(initialSettings: PrompterSettings) {
  const [settings, setSettingsState] = useState(initialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const settingsDirtyRef = useRef(false);
  const settingsSaveRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const [storageError, setStorageError] = useState<string | null>(null);
  const [adjustmentFeedback, setAdjustmentFeedback] = useState<AdjustmentFeedback | null>(null);
  const adjustmentExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adjustmentRemoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Una recarga automática (actualización del Service Worker) primero vacía
  // el guardado pendiente; IndexedDB es la única copia de estos ajustes.
  useEffect(() => {
    const unregister = registerPendingSaveFlush(async () => {
      if (!(await persistSettings())) {
        throw new Error('Prompter settings could not be saved');
      }
    });
    return () => {
      unregister();
      void persistSettings();
    };
  }, [persistSettings]);

  useEffect(
    () => () => {
      if (adjustmentExitTimerRef.current) clearTimeout(adjustmentExitTimerRef.current);
      if (adjustmentRemoveTimerRef.current) clearTimeout(adjustmentRemoveTimerRef.current);
    },
    []
  );

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

  const updateSetting = useCallback(
    (key: AdjustableSetting, value: number, showFeedback = false) => {
      const limit =
        key === 'speed' ? SPEED_LIMITS : key === 'fontSize' ? FONT_LIMITS : MARGIN_LIMITS;
      const normalizedValue = clampToLimit(value, limit);
      const current = settingsRef.current;
      if (current[key] === normalizedValue) return;
      const next = { ...current, [key]: normalizedValue };
      settingsRef.current = next;
      settingsDirtyRef.current = true;
      setSettingsState(next);
      if (showFeedback) showAdjustmentFeedback(key, normalizedValue);
    },
    [showAdjustmentFeedback]
  );

  const dismissStorageError = useCallback(() => setStorageError(null), []);

  return {
    settings,
    settingsRef,
    updateSetting,
    persistSettings,
    storageError,
    dismissStorageError,
    adjustmentFeedback
  };
}
