'use client';
import { useEffect, useSyncExternalStore } from 'react';
function subscribe(update: () => void) {
  window.addEventListener('online', update); window.addEventListener('offline', update);
  return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
}
export function AppLifecycle() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => { /* A aplicação online permanece utilizável sem SW. */ });
    const preventOfflineWrite = (event: Event) => {
      if (navigator.onLine) return;
      if (event.type === 'submit' || (event.target instanceof Element && event.target.closest('button[data-write]'))) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    document.addEventListener('submit', preventOfflineWrite, true);
    document.addEventListener('click', preventOfflineWrite, true);
    return () => { document.removeEventListener('submit', preventOfflineWrite, true); document.removeEventListener('click', preventOfflineWrite, true); };
  }, []);
  return !online ? <div className="connection-banner" role="alert">Sem conexão. Conecte-se à internet para registrar novos dados. Seus campos permanecem nesta tela.</div> : null;
}
