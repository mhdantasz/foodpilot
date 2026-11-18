'use client';

import { useState, useTransition } from 'react';
import { CalendarCheck, CheckCircle, LoaderCircle, DollarSign } from 'lucide-react';
import type { SellerWeek } from '@/lib/sellers/types';
import { formatMoney } from '@/lib/money';
import { StatusBadge } from '@/components/ui';
import { markSellerWeekPaidAction } from '@/app/(app)/equipe/actions';

export function TeamWeeksList({ weeks, timezone = 'America/Manaus' }: { weeks: SellerWeek[]; timezone?: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingWeeks, setPendingWeeks] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const handleMarkPaid = (week: SellerWeek) => {
    const confirmText = `Confirmar registro de pagamento de ${formatMoney(week.commission_cents)} para ${week.seller_name}?

Atenção: Esta ação é apenas um registro interno no sistema para controle e NÃO transfere dinheiro nem realiza Pix.`;

    if (!window.confirm(confirmText)) return;

    setErrors(prev => ({ ...prev, [week.id]: '' }));
    setPendingWeeks(prev => ({ ...prev, [week.id]: true }));
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('week_id', week.id);
        const res = await markSellerWeekPaidAction(formData);
        if (!res.ok) setErrors(prev => ({ ...prev, [week.id]: res.message }));
      } catch {
        setErrors(prev => ({ ...prev, [week.id]: 'Não foi possível registrar o pagamento. Verifique sua conexão e tente novamente.' }));
      } finally {
        setPendingWeeks(prev => ({ ...prev, [week.id]: false }));
      }
    });
  };

  if (weeks.length === 0) {
    return (
      <p className="muted" style={{ padding: '20px 0', textAlign: 'center' }}>
        Nenhuma semana fechada até o momento. Use o botão “Fechar semana” em um vendedor para gerar o primeiro fechamento.
      </p>
    );
  }

  return (
    <div className="table-scroll">
      <table className="seller-table" aria-label="Semanas fechadas de vendedores">
        <thead>
          <tr>
            <th scope="col">Vendedor</th>
            <th scope="col">Período Fechado</th>
            <th scope="col">Total Vendido</th>
            <th scope="col">Comissão Devida</th>
            <th scope="col">Vendas</th>
            <th scope="col">Situação</th>
            <th scope="col" style={{ textAlign: 'right' }}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map(week => {
            const isPending = pendingWeeks[week.id];
            const isPaid = week.status === 'paid';

            return (
              <tr key={week.id}>
                <td>
                  <strong>{week.seller_name}</strong>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarCheck size={16} color="var(--color-primary)" aria-hidden="true" />
                    <span>
                      {week.starts_on} até {week.ends_on}
                    </span>
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
                  {isPaid ? (
                    <div>
                      <StatusBadge tone="success">
                        <CheckCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                        Pago
                      </StatusBadge>
                      {week.paid_at && (
                        <small style={{ display: 'block', color: 'var(--color-muted)', marginTop: 2 }}>
                          {new Date(week.paid_at).toLocaleDateString('pt-BR', { timeZone: timezone })}
                        </small>
                      )}
                    </div>
                  ) : (
                    <StatusBadge tone="warning">Pendente</StatusBadge>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {errors[week.id] && <p role="alert" className="error-message">{errors[week.id]}</p>}
                  {!isPaid && (
                    <button
                      type="button"
                      className="action-button secondary"
                      onClick={() => handleMarkPaid(week)}
                      disabled={isPending}
                      aria-busy={isPending}
                      style={{ minHeight: 38, padding: '6px 12px', fontSize: 12 }}
                    >
                      {isPending ? (
                        <LoaderCircle className="loading-icon" size={14} />
                      ) : (
                        <DollarSign size={14} aria-hidden="true" />
                      )}
                      Registrar pagamento
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
