import type { Metadata, Viewport } from 'next';
import './globals.css';
import { branding } from '@/config/branding';
import { AppLifecycle } from '@/components/app-lifecycle';
export const metadata: Metadata = { title: { default: `Início | ${branding.appName}`, template: `%s | ${branding.appName}` }, description: branding.description, applicationName: branding.appName, appleWebApp: { capable: true, title: branding.shortName, statusBarStyle: 'default' }, icons: { apple: '/icons/apple-180.png' }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: branding.themeColor };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><AppLifecycle />{children}</body></html>;
}
