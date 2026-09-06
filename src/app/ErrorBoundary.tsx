import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './App.module.css';

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { crashed: boolean };

/**
 * Última línea de defensa: un fallo de renderizado muestra una salida de
 * recuperación en vez de una página en blanco. Los datos viven en IndexedDB,
 * así que recargar no destruye nada.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { crashed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unexpected render failure', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.crashed) return this.props.children;
    return (
      <main className={styles.fatalError}>
        <h1>Something went wrong</h1>
        <p>The app hit an unexpected error. Your scripts are safe on this device.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload</button>
      </main>
    );
  }
}
