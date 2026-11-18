import { requireUser } from '@/lib/auth/context';
import { getSellerPortal } from '@/lib/sellers/data';
import type { SellerPortal } from '@/lib/sellers/types';
import { PageHeader } from '@/components/ui';
import { InviteAcceptCard } from '@/components/sellers/invite-accept-card';
import { SellerSaleForm } from '@/components/sellers/seller-sale-form';
import { DateFilter } from '@/components/sellers/date-filter';
import { SellerMetricsCard } from '@/components/sellers/seller-metrics-card';
import { SellerHistory } from '@/components/sellers/seller-history';
import { ShieldAlert } from 'lucide-react';

export const metadata = {
  title: { absolute: 'MD Seller' },
};

export const dynamic = 'force-dynamic';

export default async function VendedorPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // Vendedor requer requireUser somente e getSellerPortal, jamais requireBusiness
  await requireUser('/entrar-vendedor');

  const { from, to } = await searchParams;
  let portal: SellerPortal | null = null;
  let error: string | null = null;

  try {
    portal = await getSellerPortal(from || undefined, to || undefined);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Não foi possível carregar os dados do vendedor.';
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Painel do Vendedor"
          description="Acompanhe suas vendas e comissões."
        />
        <div role="alert" className="form-message error" style={{ padding: 20, margin: '24px 0' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Não foi possível carregar o painel de vendas
          </h2>
          <p>{error}</p>
          <div style={{ marginTop: 14 }}>
            <a href="/vendedor" className="action-button secondary">
              Tentar novamente
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!portal) return null;

  // 1. Caso o usuário ainda não esteja vinculado a nenhum vendedor
  if (!portal.seller) {
    return (
      <div>
        <PageHeader
          title="Ativação de Vendedor"
          description="Vincule sua conta ao negócio para começar a registrar vendas."
        />
        <InviteAcceptCard />
      </div>
    );
  }

  const isInactive = !portal.seller.active;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title={`Olá, ${portal.seller.name}`}
        description="Registre vendas rápidas e consulte o extrato de suas comissões."
      />

      {/* 2. Caso vendedor esteja com acesso suspenso */}
      {isInactive ? (
        <div
          role="alert"
          className="form-message error"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 18 }}
        >
          <ShieldAlert size={24} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            <strong style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>
              Acesso suspenso
            </strong>
            <p style={{ margin: 0 }}>
              Seu cadastro de vendedor está temporariamente inativo. O registro de novas vendas está bloqueado.
              Entre em contato com o gerente para reativar seu acesso.
            </p>
          </div>
        </div>
      ) : (
        /* 3. Vendedor ativo: formulário de registro rápido */
        <SellerSaleForm offers={portal.offers} />
      )}

      {/* Filtro de período */}
      <DateFilter
        from={from || portal.period.from}
        to={to || portal.period.to}
        calendarDays={portal.period.calendar_days}
        timezone={portal.period.timezone}
      />

      {/* Métricas e produtos do vendedor (sem custos ou lucro do gerente) */}
      <SellerMetricsCard
        metric={portal.metrics}
        period={portal.period}
        products={portal.products}
      />

      {/* Semanas fechadas e histórico de vendas */}
      <SellerHistory
        sales={portal.sales}
        weeks={portal.weeks}
        historyLimit={portal.history_limit}
        timezone={portal.period.timezone}
      />
    </div>
  );
}
