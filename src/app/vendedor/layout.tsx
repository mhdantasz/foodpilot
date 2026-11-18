import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth/context';
import { getSellerAccess } from '@/lib/sellers/data';
import { Brand } from '@/components/brand';
import { SessionSync } from '@/components/session-sync';
import { LogoutButton } from '@/features/auth/auth-form';
import { InstallApp } from '@/components/install-app';
import '@/components/sellers/sellers.css';
import { sellerAppName } from '@/config/branding';

export const metadata = { applicationName: sellerAppName, manifest: '/vendedor/manifest.webmanifest', appleWebApp: { capable: true, title: sellerAppName, statusBarStyle: 'default' as const } };

export const dynamic = 'force-dynamic';

export default async function VendedorLayout({ children }: { children: ReactNode }) {
  // Vendedor requer requireUser somente, jamais requireBusiness
  const context = await requireUser('/entrar-vendedor');
  const seller = context.seller ?? (await getSellerAccess());

  return (
    <div className="seller-app">
      <SessionSync />
      <header className="seller-header">
        <div className="seller-header-inner">
          <Brand href="/vendedor" name={sellerAppName} />

          <div className="seller-user-badge">
            <div className="seller-user-info">
              <strong className="seller-user-name">
                {seller?.name || context.profile?.full_name || 'Vendedor'}
              </strong>
              <small className="seller-user-role">
                {seller ? (seller.active ? 'Vendedor conectado' : 'Acesso suspenso') : 'Vendedor'}
              </small>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main id="main" className="seller-main">
        <div className="seller-container">
          {children}

          <div className="seller-footer-install">
            <InstallApp name={sellerAppName} />
          </div>
        </div>
      </main>

      <footer className="seller-footer">
        <p>{sellerAppName} · Painel de Vendas Externas</p>
      </footer>
    </div>
  );
}
