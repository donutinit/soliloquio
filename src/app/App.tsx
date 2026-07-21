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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const applyUpdateRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    void seedSampleScripts().finally(() => setReady(true));
    applyUpdateRef.current = setupPWA(() => setUpdateAvailable(true));
  }, []);

  if (!ready) return null;

  return (
    <>
      {updateAvailable && (
        <div className={styles.updateBanner} role="status">
          <span>Hay una versión nueva disponible.</span>
          <button
            type="button"
            data-testid="apply-update"
            onClick={() => void applyUpdateRef.current?.()}
          >
            Actualizar
          </button>
        </div>
      )}
      {route.page === 'scripts' ? (
        <ScriptsPage navigate={navigate} />
      ) : (
        <PrompterPage scriptId={route.scriptId} navigate={navigate} />
      )}
    </>
  );
}
