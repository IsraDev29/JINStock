import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initSyncManager } from './services/syncService';
import { ErrorBoundary } from './components/ErrorBoundary';

// Registrar Service Worker para soporte offline inmediato (PWA)
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] Nuevo contenido disponible, actualizando...');
  },
  onOfflineReady() {
    console.log('[PWA] Aplicación lista para operar sin internet.');
  },
});

// C-01 & F-01: Inicializar el gestor de sincronización offline-first de forma segura
try {
  initSyncManager();
} catch (err) {
  console.warn('[SyncManager] Error al inicializar gestor offline:', err);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
