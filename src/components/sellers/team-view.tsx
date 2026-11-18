'use client';

import { useState } from 'react';
import { UserPlus, Tag, CalendarClock, DollarSign, Award, Package, TrendingUp } from 'lucide-react';
import type { TeamDashboard } from '@/lib/sellers/types';
import { formatMoney } from '@/lib/money';
import { StatCard, SectionCard } from '@/components/ui';
import { TeamSellerList } from './team-seller-list';
import { TeamSellerCreateModal } from './team-seller-create-form';
import { TeamOfferModal } from './team-offer-form';
import { TeamWeekCloseModal } from './team-week-close-form';
import { TeamWeeksList } from './team-weeks-list';
import { TeamSalesList } from './team-sales-list';
import { TeamProductsRanking } from './team-products-ranking';

export function TeamView({ dashboard }: { dashboard: TeamDashboard }) {
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [targetSellerId, setTargetSellerId] = useState<string | undefined>(undefined);
  const [targetVariantId, setTargetVariantId] = useState<string | undefined>(undefined);

  const handleOpenOfferModal = (sellerId?: string, variantId?: string) => {
    setTargetSellerId(sellerId);
    setTargetVariantId(variantId);
    setIsOfferModalOpen(true);
  };

  const handleOpenWeekModal = (sellerId?: string) => {
    setTargetSellerId(sellerId);
    setIsWeekModalOpen(true);
  };

  return (
    <div className="team-dashboard">
      {/* Botões de Ação Rápida no Topo */}
      <div className="seller-action-toolbar">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="action-button"
            onClick={() => setIsSellerModalOpen(true)}
          >
            <UserPlus size={18} aria-hidden="true" />
            Novo vendedor
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => handleOpenOfferModal()}
            disabled={dashboard.sellers.length === 0}
          >
            <Tag size={18} aria-hidden="true" />
            Configurar ofertas
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => handleOpenWeekModal()}
            disabled={dashboard.sellers.length === 0}
          >
            <CalendarClock size={18} aria-hidden="true" />
            Fechar semana
          </button>
        </div>
      </div>

      {/* Cartões de Indicadores da Operação */}
      <div className="stats-grid">
        <StatCard
          label="Receita da Equipe"
          value={formatMoney(dashboard.totals.revenue_cents)}
          note={`${dashboard.totals.units} unidades em ${dashboard.totals.sale_count} vendas`}
          icon={DollarSign}
          accent
        />
        <StatCard
          label="Comissões geradas"
          value={formatMoney(dashboard.totals.commission_cents)}
          note="Total acumulado no período filtrado"
          icon={Award}
        />
        <StatCard
          label="Custo das Mercadorias (CMV)"
          value={formatMoney(dashboard.totals.cost_cents)}
          note="Custo real das mercadorias vendidas"
          icon={Package}
        />
        <StatCard
          label="Resultado da Operação"
          value={formatMoney(dashboard.totals.result_cents)}
          note="Após custo e comissão, sem despesas gerais"
          icon={TrendingUp}
        />
      </div>

      {/* Seção 1: Vendedores da Equipe */}
      <SectionCard
        title="Vendedores e Desempenho Individual"
        aside={
          <span className="subtle-label">
            {dashboard.sellers.length} {dashboard.sellers.length === 1 ? 'vendedor' : 'vendedores'}
          </span>
        }
      >
        <TeamSellerList
          sellers={dashboard.sellers}
          metrics={dashboard.metrics}
          offers={dashboard.offers}
          sellerProducts={dashboard.seller_products}
          timezone={dashboard.period.timezone}
          onOpenOfferModal={handleOpenOfferModal}
          onOpenWeekCloseModal={handleOpenWeekModal}
        />
      </SectionCard>

      {/* Seção 2: Ofertas Configuradas por Vendedor */}
      <SectionCard
        title="Ofertas e Comissões Vigentes"
        aside={
          <button
            type="button"
            className="action-button secondary"
            onClick={() => handleOpenOfferModal()}
            disabled={dashboard.sellers.length === 0}
            style={{ minHeight: 36, padding: '6px 12px', fontSize: 12 }}
          >
            <Tag size={14} aria-hidden="true" />
            Nova oferta
          </button>
        }
      >
        <p className="muted" style={{ marginBottom: 16 }}>
          Preço e comissão configurados por variante para cada vendedor. Salgados são registrados por porção.
        </p>
        {dashboard.offers.length === 0 ? (
          <p className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>
            Nenhuma oferta configurada ainda. Clique em “Nova oferta” para definir produtos e comissões.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="seller-table" aria-label="Tabela de ofertas vigentes">
              <thead>
                <tr>
                  <th scope="col">Vendedor</th>
                  <th scope="col">Produto / Variante</th>
                  <th scope="col">Preço Praticado</th>
                  <th scope="col">Comissão / Unidade</th>
                  <th scope="col">Após comissão, antes dos custos</th>
                  <th scope="col">Situação</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.offers.map(offer => {
                  const seller = dashboard.sellers.find(s => s.id === offer.seller_id);
                  const netStore = offer.price_cents - offer.commission_cents;
                  return (
                    <tr key={offer.id}>
                      <td>
                        <strong>{seller?.name || 'Vendedor'}</strong>
                        <small style={{ display: 'block', color: 'var(--color-muted)' }}>{seller?.location}</small>
                      </td>
                      <td>
                        <strong>{offer.product_name}</strong>
                        <small style={{ display: 'block', color: 'var(--color-muted)' }}>{offer.variant_name}</small>
                      </td>
                      <td>{formatMoney(offer.price_cents)}</td>
                      <td>
                        <strong style={{ color: 'var(--color-success)' }}>
                          {formatMoney(offer.commission_cents)}
                        </strong>
                      </td>
                      <td>{formatMoney(netStore)}</td>
                      <td>
                        <span className={`badge ${offer.active ? 'success' : 'neutral'}`}>
                          {offer.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="action-button secondary"
                          onClick={() => handleOpenOfferModal(offer.seller_id, offer.variant_id)}
                          style={{ minHeight: 34, padding: '4px 10px', fontSize: 12 }}
                        >
                          Alterar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Seção 3: Fechamentos Semanais e Pagamentos */}
      <SectionCard
        title="Fechamento Semanal de Comissões"
        aside={
          <button
            type="button"
            className="action-button secondary"
            onClick={() => handleOpenWeekModal()}
            disabled={dashboard.sellers.length === 0}
            style={{ minHeight: 36, padding: '6px 12px', fontSize: 12 }}
          >
            <CalendarClock size={14} aria-hidden="true" />
            Novo fechamento
          </button>
        }
      >
        <p className="muted" style={{ marginBottom: 16 }}>
          Períodos semanais de exatamente 7 dias completos, com término até ontem. O registro de pagamento é contábil e NÃO realiza transferência bancária automática.
        </p>
        <TeamWeeksList weeks={dashboard.weeks} timezone={dashboard.period.timezone} />
      </SectionCard>

      {/* Seção 4: Ranking de Produtos da Equipe */}
      <SectionCard title="Ranking de Produtos Vendidos pela Equipe">
        <TeamProductsRanking products={dashboard.products} />
      </SectionCard>

      {/* Seção 5: Histórico das Últimas Vendas */}
      <SectionCard
        title="Histórico de Vendas da Equipe"
        aside={
          <span className="subtle-label">
            Últimas {dashboard.history_limit} vendas registradas
          </span>
        }
      >
        <TeamSalesList sales={dashboard.sales} historyLimit={dashboard.history_limit} timezone={dashboard.period.timezone} />
      </SectionCard>

      {/* Modais */}
      {isSellerModalOpen && <TeamSellerCreateModal
        isOpen={isSellerModalOpen}
        onClose={() => setIsSellerModalOpen(false)}
      />}

      {isOfferModalOpen && <TeamOfferModal
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        sellers={dashboard.sellers}
        variants={dashboard.variants}
        initialSellerId={targetSellerId}
        initialVariantId={targetVariantId}
        existingOffers={dashboard.offers}
      />}

      {isWeekModalOpen && <TeamWeekCloseModal
        isOpen={isWeekModalOpen}
        onClose={() => setIsWeekModalOpen(false)}
        sellers={dashboard.sellers}
        initialSellerId={targetSellerId}
        timezone={dashboard.period.timezone}
      />}
    </div>
  );
}
