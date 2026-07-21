import { useCallback, useEffect, useState } from 'react';
import { useRoute } from './router';
import { useGamepadNavigation } from './useGamepadNavigation';
import { ScriptsPage } from '../pages/ScriptsPage/ScriptsPage';
import { PrompterPage } from '../pages/PrompterPage/PrompterPage';
import { getSettings, seedSampleScripts } from '../services/database';
import { setupPWA } from '../services/pwa';
import { applyKeepScreenAwake } from '../services/keepAwake';
import styles from './App.module.css';

export function App() {
  const [route, navigate] = useRoute();
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState(false);
  const [gamepadReturnFocusId, setGamepadReturnFocusId] = useState<string | undefined>();

  const navigateFromScripts = useCallback(
    (hash: string) => {
      setGamepadReturnFocusId(undefined);
      navigate(hash);
    },
    [navigate]
  );

  const returnToScripts = useCallback(
    (focusScriptId?: string) => {
      setGamepadReturnFocusId(focusScriptId);
      navigate('#/');
    },
    [navigate]
  );

  useGamepadNavigation(route.page === 'prompter' ? 'prompter' : 'scripts');

  useEffect(() => {
    void seedSampleScripts()
      .then(() => setInitializationError(false))
      .catch(() => setInitializationError(true))
      .finally(() => setReady(true));
    // Auto-update: aplica y recarga en cuanto haya versión nueva publicada.
    setupPWA();
  }, []);

  // Pantalla encendida mientras la app está abierta, si el ajuste lo permite.
  useEffect(() => {
    void getSettings()
      .then((settings) => applyKeepScreenAwake(settings.keepScreenAwake))
      .catch(() => applyKeepScreenAwake(true));
  }, []);

  if (!ready) return <div className={styles.loading} role="status">Opening your library…</div>;

  if (initializationError) {
    return (
      <main className={styles.fatalError}>
        <h1>Your library could not be opened</h1>
        <p>Check available device storage, then try again. No data was deleted.</p>
        <button type="button" onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  }

  return (
    <>
      {route.page === 'scripts' ? (
        <ScriptsPage
          navigate={navigateFromScripts}
          initialEditingId={route.editScriptId}
          initialGamepadFocusId={gamepadReturnFocusId}
        />
      ) : (
        <PrompterPage
          scriptId={route.scriptId}
          navigate={navigate}
          returnToScripts={returnToScripts}
        />
      )}
    </>
  );
}
