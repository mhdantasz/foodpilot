import { Clock, CalendarCheck, Ban, CheckCircle } from 'lucide-react';
import type { SellerSale, SellerWeek } from '@/lib/sellers/types';
import { formatMoney } from '@/lib/money';
import { SectionCard, StatusBadge } from '@/components/ui';

function paymentLabel(method: string): string {
  switch (method) {
    case 'pix':
      return 'Pix';
    case 'card':
      return 'Cartão';
    case 'cash':
      return 'Dinheiro';
    case 'other':
      return 'Outro';
    default:
      return method;
  }
}

export function SellerHistory({
  sales,
  weeks,
  historyLimit = 100,
  timezone = 'America/Manaus',
}: {
  sales: SellerSale[];
  weeks: SellerWeek[];
  historyLimit?: number;
  timezone?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Semanas Fechadas */}
      <SectionCard
        title="Semanas Fechadas e Pagamentos"
        aside={
          <span className="subtle-label">
            {weeks.length} {weeks.length === 1 ? 'semana registrada' : 'semanas registradas'}
          </span>
        }
      >
        <p className="muted" style={{ marginBottom: 16 }}>
          O gerente fecha os períodos semanais de vendas e registra os pagamentos das comissões.
        </p>

        {weeks.length === 0 ? (
          <p className="muted" style={{ padding: '16px 0' }}>
            Nenhum fechamento semanal realizado ainda.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="seller-table" aria-label="Semanas de comissão fechadas">
              <thead>
                <tr>
                  <th scope="col">Período</th>
                  <th scope="col">Total Vendido</th>
                  <th scope="col">Comissão</th>
                  <th scope="col">Vendas</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map(week => (
                  <tr key={week.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CalendarCheck size={16} color="var(--color-primary)" aria-hidden="true" />
                        <strong>
                          {week.starts_on} até {week.ends_on}
                        </strong>
                      </div>
                      <small style={{ color: 'var(--color-muted)' }}>
                        Fechado em {new Date(week.closed_at).toLocaleDateString('pt-BR', { timeZone: timezone })}
                      </small>
                    </td>
                    <td>{formatMoney(week.total_cents)}</td>
                    <td>
                      <strong style={{ color: 'var(--color-success)' }}>
                        {formatMoney(week.commission_cents)}
                      </strong>
                    </td>
                    <td>{week.sale_count}</td>
                    <td>
                      {week.status === 'paid' ? (
                        <StatusBadge tone="success">
                          <CheckCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                          Pago
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Aguardando pagamento</StatusBadge>
                      )}
                      {week.paid_at && (
                        <small style={{ display: 'block', color: 'var(--color-muted)', marginTop: 2 }}>
                          {new Date(week.paid_at).toLocaleDateString('pt-BR', { timeZone: timezone })}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Histórico das Vendas */}
      <SectionCard
        title="Histórico das Últimas Vendas"
        aside={
          <span className="subtle-label">
            Exibindo até {historyLimit} vendas
          </span>
        }
      >
        {sales.length === 0 ? (
          <p className="muted" style={{ padding: '16px 0' }}>
            Nenhuma venda registrada no período selecionado.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="seller-table" aria-label="Histórico de vendas do vendedor">
              <thead>
                <tr>
                  <th scope="col">Data e Hora</th>
                  <th scope="col">Produtos</th>
                  <th scope="col">Pagamento</th>
                  <th scope="col">Total</th>
                  <th scope="col">Sua Comissão</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => {
                  const isCancelled = sale.status === 'cancelled';
                  return (
                    <tr
                      key={sale.id}
                      style={{ opacity: isCancelled ? 0.65 : 1 }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} color="var(--color-muted)" aria-hidden="true" />
                          <span>
                            {new Date(sale.sold_at).toLocaleString('pt-BR', {
                              timeZone: timezone,
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        {sale.items.map((item, idx) => (
                          <div key={idx} style={{ fontSize: 13 }}>
                            {item.quantity}x {item.product_name} ({item.variant_name})
                          </div>
                        ))}
                      </td>
                      <td>{paymentLabel(sale.payment_method)}</td>
                      <td>
                        <strong style={{ textDecoration: isCancelled ? 'line-through' : undefined }}>
                          {formatMoney(sale.total_cents)}
                        </strong>
                      </td>
                      <td>
                        <strong
                          style={{
                            color: isCancelled ? 'inherit' : 'var(--color-success)',
                            textDecoration: isCancelled ? 'line-through' : undefined,
                          }}
                        >
                          {formatMoney(sale.commission_cents)}
                        </strong>
                      </td>
                      <td>
                        {isCancelled ? (
                          <div>
                            <StatusBadge tone="neutral">
                              <Ban size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                              Cancelada
                            </StatusBadge>
                            {sale.cancellation_reason && (
                              <small style={{ display: 'block', color: 'var(--color-error)', marginTop: 4 }}>
                                Motivo: {sale.cancellation_reason}
                              </small>
                            )}
                          </div>
                        ) : (
                          <StatusBadge tone="success">Ativa</StatusBadge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
