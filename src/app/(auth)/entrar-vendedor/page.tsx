import { AuthCard } from '@/features/auth/auth-card';
import { AuthForm } from '@/features/auth/auth-form';
import { redirectAuthenticated } from '@/lib/auth/context';

export const metadata = { title: { absolute: 'MD Seller' }, applicationName: 'MD Seller', manifest: '/vendedor/manifest.webmanifest', appleWebApp: { capable: true, title: 'MD Seller' } };
export default async function SellerLoginPage() {
  await redirectAuthenticated();
  return <AuthCard brandName="MD Seller" title="Suas vendas, organizadas." description="Entre com o acesso criado pelo seu gerente."><AuthForm mode="login" sellerOnly /></AuthCard>;
}
