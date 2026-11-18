'use client';

import { useState, useTransition } from 'react';
import { Clock, Ban, LoaderCircle, X, AlertTriangle } from 'lucide-react';
import type { SellerSale } from '@/lib/sellers/types';
import { formatMoney } from '@/lib/money';
import { StatusBadge } from '@/components/ui';
import { cancelSellerSaleAction } from '@/app/(app)/equipe/actions';
import { useModalFocus } from '@/components/use-modal-focus';

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

export function TeamSalesList({
  sales,
  historyLimit = 100,
  timezone = 'America/Manaus',
}: {
  sales: SellerSale[];
  historyLimit?: number;
  timezone?: string;
}) {
  const [cancellingSale, setCancellingSale] = useState<SellerSale | null>(null);
  const [reason, setReason] = useState('');
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const modal = useModalFocus(Boolean(cancellingSale), () => setCancellingSale(null), !isPending);

  const handleOpenCancel = (sale: SellerSale) => {
    setCancellingSale(sale);
    setReason('');
    setConfirmCheckbox(false);
    setError(null);
  };

  const handleCloseCancel = () => {
    setCancellingSale(null);
    setReason('');
    setError(null);
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingSale || !reason.trim() || !confirmCheckbox || isPending) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('sale_id', cancellingSale.id);
        formData.set('reason', reason.trim());

        const res = await cancelSellerSaleAction(formData);
        if (res.ok) {
          handleCloseCancel();
        } else {
          setError(res.message);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao cancelar venda.');
      }
    });
  };

  if (sales.length === 0) {
    return (
      <p className="muted" style={{ padding: '20px 0', textAlign: 'center' }}>
        Nenhuma venda registrada na equipe para o período filtrado.
      </p>
    );
  }

  return (
    <>
      <p className="muted" style={{ marginBottom: 12 }}>Até {historyLimit} vendas do período. Reduza o intervalo para consultar datas anteriores.</p>
      <div className="table-scroll">
        <table className="seller-table" aria-label="Histórico de vendas da equipe">
          <thead>
            <tr>
              <th scope="col">Data e Hora</th>
              <th scope="col">Vendedor</th>
              <th scope="col">Produtos e Quantidades</th>
              <th scope="col">Pagamento</th>
              <th scope="col">Total</th>
              <th scope="col">Comissão</th>
              <th scope="col">Situação</th>
              <th scope="col" style={{ textAlign: 'right' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {sales.map(sale => {
              const isCancelled = sale.status === 'cancelled';

              return (
                <tr key={sale.id} style={{ opacity: isCancelled ? 0.65 : 1 }}>
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
                    <strong>{sale.seller_name}</strong>
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
                            {sale.cancellation_reason}
                          </small>
                        )}
                      </div>
                    ) : (
                      <StatusBadge tone="success">Ativa</StatusBadge>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {!isCancelled && (
                      <button
                        type="button"
                        className="action-button secondary"
                        onClick={() => handleOpenCancel(sale)}
                        style={{ minHeight: 34, padding: '4px 10px', fontSize: 12, color: 'var(--color-error)' }}
                        aria-label={`Cancelar venda de ${sale.seller_name}`}
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cancellingSale && (
        <div
          className="seller-modal-backdrop"
          onClick={() => { if (!isPending) handleCloseCancel(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
        >
          <div ref={modal} tabIndex={-1} className="seller-modal-card" onClick={e => e.stopPropagation()}>
            <div className="seller-modal-header">
              <h3 id="cancel-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-error)' }}>
                <AlertTriangle size={20} color="var(--color-error)" aria-hidden="true" />
                Cancelar Venda da Equipe
              </h3>
              <button
                type="button"
                className="icon-button"
                onClick={handleCloseCancel}
                aria-label="Fechar janela"
              >
                <X size={20} />
              </button>
            </div>

            <p className="muted" style={{ fontSize: 13 }}>
              Vendedor: <strong>{cancellingSale.seller_name}</strong> · Valor:{' '}
              <strong>{formatMoney(cancellingSale.total_cents)}</strong> (Comissão: {formatMoney(cancellingSale.commission_cents)}).
              O cancelamento remove o valor do faturamento e zera a comissão para fechamento futuro, mantendo registro auditável.
            </p>

            {error && (
              <div role="alert" className="form-message error">
                {error}
              </div>
            )}

            <form onSubmit={handleConfirmCancel} className="commerce-form" aria-label="Cancelar venda">
              <fieldset disabled={isPending} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
                <label>
                  Motivo do cancelamento (obrigatório para auditoria)
                  <input
                    type="text"
                    name="reason"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Ex: Lançamento duplicado ou produto devolvido"
                    required
                    minLength={5}
                    maxLength={500}
                  />
                </label>

                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox}
                    onChange={e => setConfirmCheckbox(e.target.checked)}
                    required
                  />
                  Confirmo o cancelamento desta venda e o estorno da comissão correspondente.
                </label>

                <div className="commerce-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    type="button"
                    className="action-button secondary"
                    onClick={handleCloseCancel}
                    disabled={isPending}
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="action-button"
                    style={{ background: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                    disabled={isPending || !reason.trim() || !confirmCheckbox}
                    aria-busy={isPending}
                  >
                    {isPending ? (
                      <>
                        <LoaderCircle className="loading-icon" size={16} />
                        Cancelando…
                      </>
                    ) : (
                      'Confirmar Cancelamento'
                    )}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
