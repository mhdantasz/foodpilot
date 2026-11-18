import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TeamView } from '@/components/sellers/team-view';
import { SellerSaleForm } from '@/components/sellers/seller-sale-form';
import { SellerMetricsCard } from '@/components/sellers/seller-metrics-card';
import { SellerHistory } from '@/components/sellers/seller-history';
import { DateFilter } from '@/components/sellers/date-filter';
import { AppShell } from '@/components/app-shell';
import type { TeamDashboard } from '@/lib/sellers/types';
import '@/components/sellers/sellers.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prévia local de vendedores', robots: { index: false, follow: false } };

// Development-only fixtures, never inserted into a database or available in production.
export default async function SellerPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV !== 'development' || process.env.SELLERS_UI_PREVIEW !== '1') notFound();
  const sellerId = '11111111-1111-4111-8111-111111111111';
  const variantId = '22222222-2222-4222-8222-222222222222';
  const offerId = '33333333-3333-4333-8333-333333333333';
  const metric = { seller_id: sellerId, seller_name: 'Vendedor de exemplo', revenue_cents: 14400, commission_cents: 2400, units: 12, sale_count: 4, active_days: 2, calendar_days: 7, units_per_calendar_day: 1.71, units_per_active_day: 6, cost_cents: 9600, result_cents: 2400 };
  const product = { product_id: '44444444-4444-4444-8444-444444444444', variant_id: variantId, product_name: 'Bolo de pote', variant_name: 'Chocolate', units: 12, revenue_cents: 14400, commission_cents: 2400, calendar_days: 7, active_days: 2, units_per_calendar_day: 1.71, units_per_active_day: 6 };
  const dashboard: TeamDashboard = {
    period: { from: '2026-11-12', to: '2026-11-18', calendar_days: 7, timezone: 'America/Manaus' },
    sellers: [{ id: sellerId, name: metric.seller_name, location: 'Escola de exemplo', active: true, linked: true, created_at: '2026-11-12T12:00:00Z' }, { id: '55555555-5555-4555-8555-555555555555', name: 'Segundo vendedor', location: 'Faculdade de exemplo', active: true, linked: false, created_at: '2026-11-16T12:00:00Z' }],
    offers: [{ id: offerId, seller_id: sellerId, variant_id: variantId, product_name: product.product_name, variant_name: product.variant_name, price_cents: 1200, commission_cents: 200, active: true }],
    sales: [{ id: '66666666-6666-4666-8666-666666666666', seller_id: sellerId, seller_name: metric.seller_name, sold_at: '2026-11-18T16:00:00Z', payment_method: 'pix', total_cents: 2400, commission_cents: 400, status: 'active', cancellation_reason: null, closed_week_id: null, items: [{ product_name: product.product_name, variant_name: product.variant_name, quantity: 2, unit_price_cents: 1200, unit_commission_cents: 200, total_cents: 2400, commission_cents: 400 }] }],
    weeks: [{ id: '77777777-7777-4777-8777-777777777777', seller_id: sellerId, seller_name: metric.seller_name, starts_on: '2026-11-05', ends_on: '2026-11-11', total_cents: 14400, commission_cents: 2400, sale_count: 4, status: 'closed', closed_at: '2026-11-12T12:00:00Z', paid_at: null }],
    metrics: [metric], products: [product], seller_products: [{ ...product, seller_id: sellerId, seller_name: metric.seller_name }],
    variants: [{ id: variantId, product_name: product.product_name, variant_name: product.variant_name, sale_price_cents: 1300 }],
    totals: { revenue_cents: 14400, commission_cents: 2400, cost_cents: 9600, result_cents: 2400, units: 12, sale_count: 4 }, history_limit: 100,
  };
  const sellerView = (await searchParams).view === 'seller';
  const notice = <div className="form-message info" style={{ marginBottom: 20 }}><strong>Prévia local com dados de exemplo.</strong> Nenhuma venda desta tela está no banco. <Link href="/preview-vendedores">Ver gerente</Link> · <Link href="/preview-vendedores?view=seller">Ver vendedor</Link></div>;
  if (!sellerView) return <AppShell businessName="Operação de exemplo" userName="Gerente"><h1 style={{ marginBottom: 16 }}>Equipe de vendedores</h1>{notice}<DateFilter {...{ from: dashboard.period.from, to: dashboard.period.to, calendarDays: 7, timezone: dashboard.period.timezone }} /><TeamView dashboard={dashboard} /></AppShell>;
  return <div className="seller-app"><main className="seller-main"><div className="seller-container">{notice}<h1 style={{ marginBottom: 20 }}>Olá, vendedor</h1><SellerSaleForm offers={dashboard.offers} /><SellerMetricsCard metric={metric} period={dashboard.period} products={dashboard.products} /><SellerHistory sales={dashboard.sales} weeks={dashboard.weeks} /></div></main></div>;
}
