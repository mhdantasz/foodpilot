import { DollarSign, Award, CalendarDays, TrendingUp } from 'lucide-react';
import type { SellerMetric, SellerProductMetric, SellerPeriod } from '@/lib/sellers/types';
import { formatMoney } from '@/lib/money';
import { StatCard, SectionCard } from '@/components/ui';

export function SellerMetricsCard({
  metric,
  period,
  products,
}: {
  metric: SellerMetric | null;
  period: SellerPeriod;
  products: SellerProductMetric[];
}) {
  const revenueCents = metric?.revenue_cents ?? 0;
  const commissionCents = metric?.commission_cents ?? 0;
  const units = metric?.units ?? 0;
  const saleCount = metric?.sale_count ?? 0;
  const activeDays = metric?.active_days ?? 0;
  const calendarDays = metric?.calendar_days ?? period.calendar_days ?? 0;
  const unitsPerActiveDay = metric?.units_per_active_day ?? 0;
  const unitsPerCalendarDay = metric?.units_per_calendar_day ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Cards de Métricas */}
      <div className="stats-grid">
        <StatCard
          label="Sua comissão no período"
          value={formatMoney(commissionCents)}
          note={`Calculada sobre ${saleCount} ${saleCount === 1 ? 'venda' : 'vendas'}`}
          icon={Award}
          accent
        />
        <StatCard
          label="Total vendido (Receita)"
          value={formatMoney(revenueCents)}
          note={`${units} ${units === 1 ? 'unidade vendida' : 'unidades vendidas'}`}
          icon={DollarSign}
        />
        <StatCard
          label="Média por dia com vendas"
          value={`${unitsPerActiveDay.toFixed(1)} un/dia`}
          note={`Em ${activeDays} ${activeDays === 1 ? 'dia com vendas' : 'dias com vendas'}`}
          icon={TrendingUp}
        />
        <StatCard
          label="Média por dia de calendário"
          value={`${unitsPerCalendarDay.toFixed(1)} un/dia`}
          note={`Em ${calendarDays} ${calendarDays === 1 ? 'dia no período' : 'dias no período'}`}
          icon={CalendarDays}
        />
      </div>

      {/* Ranking de Produtos */}
      <SectionCard title="Produtos mais vendidos por você">
        {products.length === 0 ? (
          <p className="muted" style={{ padding: '16px 0' }}>
            Nenhum produto vendido no período selecionado.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="seller-table" aria-label="Ranking de produtos vendidos pelo vendedor">
              <thead>
                <tr>
                  <th scope="col">Produto / Sabor</th>
                  <th scope="col">Unidades</th>
                  <th scope="col">Total Vendido</th>
                  <th scope="col">Sua Comissão</th>
                  <th scope="col">Média (dias c/ vendas)</th>
                  <th scope="col">Média (dias corridos)</th>
                </tr>
              </thead>
              <tbody>
                {products.map(prod => (
                  <tr key={prod.variant_id}>
                    <td>
                      <strong>{prod.product_name}</strong>
                      <small style={{ display: 'block', color: 'var(--color-muted)' }}>{prod.variant_name}</small>
                    </td>
                    <td>
                      <strong>{prod.units} un</strong>
                    </td>
                    <td>{formatMoney(prod.revenue_cents)}</td>
                    <td>
                      <strong style={{ color: 'var(--color-success)' }}>
                        {formatMoney(prod.commission_cents)}
                      </strong>
                    </td>
                    <td>
                      {prod.units_per_active_day.toFixed(1)} un/dia
                      <small style={{ display: 'block', color: 'var(--color-muted)' }}>
                        ({prod.active_days} {prod.active_days === 1 ? 'dia' : 'dias'})
                      </small>
                    </td>
                    <td>
                      {prod.units_per_calendar_day.toFixed(1)} un/dia
                      <small style={{ display: 'block', color: 'var(--color-muted)' }}>
                        ({prod.calendar_days} {prod.calendar_days === 1 ? 'dia' : 'dias'})
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
