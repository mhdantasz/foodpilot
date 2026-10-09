'use client';
import { useSyncExternalStore } from 'react';
import { branding } from '@/config/branding';
function subscribe(update: () => void) { const query = matchMedia('(display-mode: standalone)'); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }
export function InstallApp() {
  const installed = useSyncExternalStore(subscribe, () => matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone), () => false);
  return <section className="section-card commerce-form"><h2>Instalar {branding.shortName}</h2>{installed ? <p>Você está usando o aplicativo instalado.</p> : <><p>No Android/Chrome: abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</p><p>No iPhone/iPad: abra no Safari, toque em Compartilhar e depois “Adicionar à Tela de Início”. No computador, use a opção de instalação na barra de endereço.</p></>}<p className="muted">Use o endereço HTTPS hospedado. É preciso estar conectado para consultar e registrar dados.</p></section>;
}
