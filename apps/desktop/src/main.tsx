import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

if (import.meta.env.VITE_E2E === 'true') {
  await import('./e2e/install-mocks');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
