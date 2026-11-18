import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth/context';
import { getTeamDashboard } from '@/lib/sellers/data';
import { listSellerLogins } from '@/lib/sellers/accounts';
import type { TeamDashboard } from '@/lib/sellers/types';
import { PageHeader } from '@/components/ui';
import { DateFilter } from '@/components/sellers/date-filter';
import { TeamView } from '@/components/sellers/team-view';
import '@/components/sellers/sellers.css';

export const metadata = {
  title: 'Equipe de Vendedores',
};

export const dynamic = 'force-dynamic';

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  // Gerente deve checar owner antes de getTeamDashboard (requireBusiness)
  const context = await requireBusiness();
  if (context.membership.role !== 'owner') {
    redirect('/');
  }

  const { from, to } = await searchParams;
  let dashboard: TeamDashboard | null = null;
  let logins: Awaited<ReturnType<typeof listSellerLogins>> = [];
  let error: string | null = null;

  try {
    [dashboard, logins] = await Promise.all([getTeamDashboard(from || undefined, to || undefined), listSellerLogins()]);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Não foi possível carregar os dados da equipe de vendedores.';
  }

  return (
    <div>
      <PageHeader
        title="Equipe de Vendedores"
        description="Acompanhe o desempenho das vendas externas, configure ofertas e comissões e realize fechamentos semanais."
      />

      {error ? (
        <div role="alert" className="form-message error" style={{ padding: 20, margin: '24px 0' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Não foi possível carregar os dados da equipe
          </h2>
          <p>{error}</p>
          <div style={{ marginTop: 14 }}>
            <a href="/equipe" className="action-button secondary">
              Tentar novamente
            </a>
          </div>
        </div>
      ) : dashboard ? (
        <>
          <DateFilter
            from={from || dashboard.period.from}
            to={to || dashboard.period.to}
            calendarDays={dashboard.period.calendar_days}
            timezone={dashboard.period.timezone}
          />
          <TeamView dashboard={dashboard} logins={logins} />
        </>
      ) : null}
    </div>
  );
}
