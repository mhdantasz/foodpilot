import type { SellerProductMetric } from '@/lib/sellers/types';
import { formatMoney } from '@/lib/money';

export function TeamProductsRanking({ products }: { products: SellerProductMetric[] }) {
  if (products.length === 0) {
    return (
      <p className="muted" style={{ padding: '20px 0', textAlign: 'center' }}>
        Nenhum produto vendido no período selecionado.
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <table className="seller-table" aria-label="Ranking de produtos vendidos pela equipe">
        <thead>
          <tr>
            <th scope="col">Produto / Variante</th>
            <th scope="col">Unidades</th>
            <th scope="col">Receita Total</th>
            <th scope="col">Comissão Total</th>
            <th scope="col">Média (dias com vendas)</th>
            <th scope="col">Média (dias no período)</th>
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
  );
}
