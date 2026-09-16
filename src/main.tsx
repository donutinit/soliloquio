import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/big-shoulders-display';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element.');
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
