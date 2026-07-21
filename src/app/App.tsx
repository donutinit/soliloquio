import { useEffect, useRef, useState } from 'react';
import { useRoute } from './router';
import { ScriptsPage } from '../pages/ScriptsPage/ScriptsPage';
import { PrompterPage } from '../pages/PrompterPage/PrompterPage';
import { seedSampleScripts } from '../services/database';
import { setupPWA } from '../services/pwa';
import styles from './App.module.css';

export function App() {
  const [route, navigate] = useRoute();
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const applyUpdateRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    void seedSampleScripts()
      .then(() => setInitializationError(false))
      .catch(() => setInitializationError(true))
      .finally(() => setReady(true));
    applyUpdateRef.current = setupPWA(() => setUpdateAvailable(true));
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
      {updateAvailable && (
        <div className={styles.updateBanner} role="status">
          <span>A new version is available.</span>
          <button
            type="button"
            data-testid="apply-update"
            onClick={() => void applyUpdateRef.current?.()}
          >
            Update
          </button>
        </div>
      )}
      {route.page === 'scripts' ? (
        <ScriptsPage navigate={navigate} initialEditingId={route.editScriptId} />
      ) : (
        <PrompterPage scriptId={route.scriptId} navigate={navigate} />
      )}
    </>
  );
}
