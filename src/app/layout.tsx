import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Início | Pronto', template: '%s | Pronto' }, description: 'Um jeito simples de cuidar das vendas do seu negócio de comida.', applicationName: 'Pronto' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#27634b' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
