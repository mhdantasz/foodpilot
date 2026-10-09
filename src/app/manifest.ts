import type { MetadataRoute } from 'next';
import { branding } from '@/config/branding';
export default function manifest(): MetadataRoute.Manifest {
  return { id: '/', name: branding.appName, short_name: branding.shortName, description: branding.description,
    lang: 'pt-BR', start_url: '/', scope: '/', display: 'standalone',
    theme_color: branding.themeColor, background_color: branding.backgroundColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
