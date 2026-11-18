'use client';

import { useState, useTransition } from 'react';
import { UserCheck, UserX, KeyRound, Copy, Check, LoaderCircle, Tag, CalendarClock, Store, Trash2 } from 'lucide-react';
import type { Seller, SellerMetric, SellerOffer, SellerProductBySellerMetric } from '@/lib/sellers/types';
import { formatMoney } from '@/lib/money';
import { StatusBadge } from '@/components/ui';
import { toggleSellerAction, createSellerInviteAction } from '@/app/(app)/equipe/actions';
import { deleteSellerLoginAction } from '@/app/(app)/equipe/account-actions';

export function TeamSellerList({
  sellers,
  metrics,
  offers,
  sellerProducts = [],
  timezone = 'America/Manaus',
  onOpenOfferModal,
  onOpenWeekCloseModal,
  onOpenLoginModal,
  logins = [],
}: {
  sellers: Seller[];
  metrics: SellerMetric[];
  offers: SellerOffer[];
  sellerProducts?: SellerProductBySellerMetric[];
  timezone?: string;
  onOpenOfferModal: (sellerId: string) => void;
  onOpenWeekCloseModal: (sellerId: string) => void;
  onOpenLoginModal?: (sellerId: string) => void;
  logins?: { seller_id: string; username: string; deleted: boolean }[];
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invites, setInvites] = useState<Record<string, string>>({});
  const [copiedSellerId, setCopiedSellerId] = useState<string | null>(null);
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({});
  const [pendingInvites, setPendingInvites] = useState<Record<string, boolean>>({});
  const [pendingDeletes, setPendingDeletes] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const handleDeleteLogin = (seller: Seller) => {
    if (!window.confirm(`Excluir o usuário de ${seller.name}? O acesso será bloqueado e o vendedor sairá da lista operacional. O histórico de vendas e pagamentos será preservado.`)) return;
    setErrors(previous => ({ ...previous, [seller.id]: '' }));
    setPendingDeletes(previous => ({ ...previous, [seller.id]: true }));
    startTransition(async () => {
      try {
        const form = new FormData(); form.set('seller_id', seller.id);
        const result = await deleteSellerLoginAction(form);
        if (!result.ok) setErrors(previous => ({ ...previous, [seller.id]: result.message }));
      } catch { setErrors(previous => ({ ...previous, [seller.id]: 'Não foi possível confirmar a exclusão. Atualize a lista antes de tentar novamente.' })); }
      finally { setPendingDeletes(previous => ({ ...previous, [seller.id]: false })); }
    });
  };

  const handleToggle = (seller: Seller) => {
    const nextActive = !seller.active;
    const confirmMessage = nextActive
      ? `Deseja reativar o acesso de ${seller.name}?`
      : `Deseja suspender ${seller.name}? O vendedor não poderá registrar novas vendas enquanto estiver suspenso.`;

    if (!window.confirm(confirmMessage)) return;

    setErrors(prev => ({ ...prev, [seller.id]: '' }));
    setPendingToggles(prev => ({ ...prev, [seller.id]: true }));
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('seller_id', seller.id);
        formData.set('active', nextActive ? 'true' : 'false');
        const res = await toggleSellerAction(formData);
        if (!res.ok) setErrors(prev => ({ ...prev, [seller.id]: res.message }));
      } catch {
        setErrors(prev => ({ ...prev, [seller.id]: 'Não foi possível alterar o acesso. Verifique sua conexão e tente novamente.' }));
      } finally {
        setPendingToggles(prev => ({ ...prev, [seller.id]: false }));
      }
    });
  };

  const handleCreateInvite = (sellerId: string) => {
    setErrors(prev => ({ ...prev, [sellerId]: '' }));
    setPendingInvites(prev => ({ ...prev, [sellerId]: true }));
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('seller_id', sellerId);
        const res = await createSellerInviteAction(formData);
        if (res.ok && res.inviteCode) {
          setInvites(prev => ({ ...prev, [sellerId]: res.inviteCode! }));
        } else {
          setErrors(prev => ({ ...prev, [sellerId]: res.message || 'Não foi possível gerar o convite.' }));
        }
      } catch {
        setErrors(prev => ({ ...prev, [sellerId]: 'Não foi possível gerar o convite. Verifique sua conexão e tente novamente.' }));
      } finally {
        setPendingInvites(prev => ({ ...prev, [sellerId]: false }));
      }
    });
  };

  const handleCopyLink = async (sellerId: string, code: string) => {
    const link = `${window.location.origin}/convite?code=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setErrors(prev => ({ ...prev, [sellerId]: '' }));
      setCopiedSellerId(sellerId);
      setTimeout(() => setCopiedSellerId(null), 3000);
    } catch {
      setErrors(prev => ({ ...prev, [sellerId]: 'Não foi possível copiar automaticamente. Selecione e copie o link exibido abaixo.' }));
    }
  };

  if (sellers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Store size={30} aria-hidden="true" />
        </div>
        <h2>Nenhum vendedor cadastrado</h2>
        <p>
          Cadastre seu primeiro vendedor para começar a definir comissões por produto e acompanhar as vendas externas.
        </p>
      </div>
    );
  }

  return (
    <div className="seller-list-grid" role="region" aria-label="Lista de vendedores da equipe">
      {sellers.map(seller => {
        const metric = metrics.find(m => m.seller_id === seller.id);
        const sellerOffers = offers.filter(o => o.seller_id === seller.id);
        const inviteCode = invites[seller.id];
        const productMetrics = sellerProducts.filter(product => product.seller_id === seller.id);
        const isTogglePending = pendingToggles[seller.id];
        const isInvitePending = pendingInvites[seller.id];
        const managedLogin = logins.find(login => login.seller_id === seller.id && !login.deleted);

        return (
          <article key={seller.id} className="seller-card-item">
            <div className="seller-card-header">
              <div>
                <h3>{seller.name}</h3>
                <p>
                  Local: <strong>{seller.location}</strong> · Cadastrado em{' '}
                  {new Date(seller.created_at).toLocaleDateString('pt-BR', { timeZone: timezone })}
                </p>
              </div>

              <div className="seller-badges">
                {seller.active ? (
                  <StatusBadge tone="success">Ativo</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Suspenso</StatusBadge>
                )}
                {seller.linked ? (
                  <StatusBadge tone="info">Conta Vinculada</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Convite Pendente</StatusBadge>
                )}
              </div>
            </div>

            {managedLogin && <p className="muted">Usuário de acesso: <strong>{managedLogin.username}</strong></p>}

            {/* Métricas no período filtrado */}
            <div className="seller-metrics-row">
              <div className="seller-metric-item">
                <span>Receita</span>
                <strong>{formatMoney(metric?.revenue_cents ?? 0)}</strong>
              </div>
              <div className="seller-metric-item">
                <span>Comissão</span>
                <strong style={{ color: 'var(--color-success)' }}>
                  {formatMoney(metric?.commission_cents ?? 0)}
                </strong>
              </div>
              <div className="seller-metric-item">
                <span>CMV (Custo)</span>
                <strong>{formatMoney(metric?.cost_cents ?? 0)}</strong>
              </div>
              <div className="seller-metric-item">
                <span>Resultado</span>
                <strong style={{ color: (metric?.result_cents ?? 0) >= 0 ? 'var(--color-primary)' : 'var(--color-error)' }}>
                  {formatMoney(metric?.result_cents ?? 0)}
                </strong>
              </div>
              <div className="seller-metric-item">
                <span>Unidades Vendidas</span>
                <strong>{metric?.units ?? 0} un</strong>
              </div>
              <div className="seller-metric-item">
                <span>Vendas Totais</span>
                <strong>{metric?.sale_count ?? 0}</strong>
              </div>
              <div className="seller-metric-item">
                <span>Média / dia c/ vendas</span>
                <strong>
                  {metric ? metric.units_per_active_day.toFixed(1) : '0'} un/dia
                </strong>
                <small style={{ color: 'var(--color-muted)' }}>
                  ({metric?.active_days ?? 0} {metric?.active_days === 1 ? 'dia' : 'dias'})
                </small>
              </div>
              <div className="seller-metric-item">
                <span>Média / dia corrido</span>
                <strong>
                  {metric ? metric.units_per_calendar_day.toFixed(1) : '0'} un/dia
                </strong>
                <small style={{ color: 'var(--color-muted)' }}>
                  ({metric?.calendar_days ?? 0} {metric?.calendar_days === 1 ? 'dia' : 'dias'})
                </small>
              </div>
            </div>

            <details className="seller-product-details">
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Vendas e médias por produto</summary>
              <p className="muted">Todo o período selecionado. A média por dia com vendas considera os dias em que este produto foi vendido.</p>
              {productMetrics.length === 0 ? <p className="muted">Nenhum produto vendido no período.</p> : (
                <div className="table-scroll">
                  <table className="seller-table" aria-label={`Médias por produto de ${seller.name}`}>
                    <thead><tr><th scope="col">Produto</th><th scope="col">Unidades</th><th scope="col">Média por dia de calendário</th><th scope="col">Média por dia com vendas</th></tr></thead>
                    <tbody>{productMetrics.map(product => <tr key={`${product.product_id}:${product.variant_id}`}>
                      <td>{product.product_name} · {product.variant_name}</td>
                      <td>{product.units}</td>
                      <td>{product.units_per_calendar_day.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un/dia <small>({product.calendar_days} dias)</small></td>
                      <td>{product.units_per_active_day.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un/dia <small>({product.active_days} dias)</small></td>
                    </tr>)}</tbody>
                  </table>
                </div>
              )}
            </details>
            {errors[seller.id] && <p role="alert" className="error-message">{errors[seller.id]}</p>}

            {/* Estado de ofertas deste vendedor */}
            <div style={{ fontSize: 13 }}>
              {sellerOffers.length === 0 ? (
                <p className="muted" style={{ fontStyle: 'italic' }}>
                  Nenhuma oferta configurada ainda para este vendedor. Clique em “Configurar ofertas” para liberar produtos.
                </p>
              ) : (
                <p className="muted">
                  <strong>{sellerOffers.length}</strong> {sellerOffers.length === 1 ? 'oferta configurada' : 'ofertas configuradas'}:{' '}
                  {sellerOffers.map(o => `${o.product_name} (${formatMoney(o.price_cents)} · comissão ${formatMoney(o.commission_cents)})`).join(', ')}
                </p>
              )}
            </div>

            {/* Caixa de convite gerado */}
            {inviteCode && (
              <div className="invite-code-box" role="status" aria-live="polite">
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
                  Link de convite gerado (válido por 7 dias, uso único):
                </span>
                <div className="invite-code-row">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/convite?code=${inviteCode}`}
                    className="invite-code-input"
                    aria-label="Link do convite"
                  />
                  <button
                    type="button"
                    className="action-button secondary"
                    onClick={() => handleCopyLink(seller.id, inviteCode)}
                    style={{ minHeight: 38, padding: '8px 12px' }}
                  >
                    {copiedSellerId === seller.id ? (
                      <>
                        <Check size={16} color="var(--color-success)" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copiar link
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Ações do vendedor */}
            <div className="seller-card-actions">
              {!seller.linked && onOpenLoginModal && <button type="button" className="action-button" disabled={!seller.active} onClick={() => onOpenLoginModal(seller.id)}><KeyRound size={16} aria-hidden="true" />Gerar login</button>}
              {managedLogin && <button type="button" className="action-button secondary" onClick={() => handleDeleteLogin(seller)} disabled={pendingDeletes[seller.id]} aria-busy={pendingDeletes[seller.id]}>{pendingDeletes[seller.id] ? <LoaderCircle className="loading-icon" size={16} /> : <Trash2 size={16} aria-hidden="true" />}{pendingDeletes[seller.id] ? 'Excluindo usuário…' : 'Excluir usuário'}</button>}
              <button
                type="button"
                className="action-button secondary"
                onClick={() => onOpenOfferModal(seller.id)}
              >
                <Tag size={16} aria-hidden="true" />
                Configurar ofertas
              </button>

              <button
                type="button"
                className="action-button secondary"
                onClick={() => onOpenWeekCloseModal(seller.id)}
              >
                <CalendarClock size={16} aria-hidden="true" />
                Fechar semana
              </button>

              <button
                type="button"
                className="action-button secondary"
                onClick={() => handleCreateInvite(seller.id)}
                disabled={isInvitePending || seller.linked || !seller.active}
                aria-busy={isInvitePending}
              >
                {isInvitePending ? (
                  <LoaderCircle className="loading-icon" size={16} />
                ) : (
                  <KeyRound size={16} aria-hidden="true" />
                )}
                Gerar convite
              </button>

              <button
                type="button"
                className={`action-button secondary ${seller.active ? '' : 'accent'}`}
                onClick={() => handleToggle(seller)}
                disabled={isTogglePending}
                aria-busy={isTogglePending}
              >
                {isTogglePending ? (
                  <LoaderCircle className="loading-icon" size={16} />
                ) : seller.active ? (
                  <UserX size={16} aria-hidden="true" />
                ) : (
                  <UserCheck size={16} aria-hidden="true" />
                )}
                {seller.active ? 'Suspender vendedor' : 'Ativar vendedor'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
