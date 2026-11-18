'use client';

import { useState, useTransition, useMemo } from 'react';
import { Tag, LoaderCircle, X, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Seller, SellerVariantOption, SellerOffer, SellerActionResult } from '@/lib/sellers/types';
import { brlToCents, formatMoney } from '@/lib/money';
import { saveSellerOfferAction } from '@/app/(app)/equipe/actions';
import { offerDefaults } from './offer-defaults';
import { useModalFocus } from '@/components/use-modal-focus';

export function TeamOfferModal({
  isOpen,
  onClose,
  sellers,
  variants,
  initialSellerId,
  initialVariantId,
  existingOffers,
}: {
  isOpen: boolean;
  onClose: () => void;
  sellers: Seller[];
  variants: SellerVariantOption[];
  initialSellerId?: string;
  initialVariantId?: string;
  existingOffers: SellerOffer[];
}) {
  const [selectedSellerId, setSelectedSellerId] = useState(initialSellerId || (sellers[0]?.id ?? ''));
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId || variants[0]?.id || '');
  const terms = offerDefaults(selectedSellerId, selectedVariantId, existingOffers, variants);
  const [priceBRL, setPriceBRL] = useState(terms.price);
  const [commissionBRL, setCommissionBRL] = useState(terms.commission);
  const [active, setActive] = useState(terms.active);
  const [result, setResult] = useState<SellerActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const modal = useModalFocus(isOpen, onClose, !isPending);
  const loadTerms = (sellerId: string, variantId: string) => {
    const defaults = offerDefaults(sellerId, variantId, existingOffers, variants);
    setPriceBRL(defaults.price); setCommissionBRL(defaults.commission); setActive(defaults.active); setResult(null);
  };

  // Quando variante muda, pode sugerir o preço padrão de venda da variação
  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    loadTerms(selectedSellerId, variantId);
  };

  const handleSellerChange = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    loadTerms(sellerId, selectedVariantId);
  };

  // Cálculo ao vivo para mostrar comissão antes de salvar
  const calculationPreview = useMemo(() => {
    try {
      const priceCents = brlToCents(priceBRL);
      const commissionCents = brlToCents(commissionBRL);
      if (priceCents <= 0 || commissionCents > priceCents) {
        return {
          valid: false,
          error: 'O preço deve ser positivo e a comissão não pode ultrapassá-lo.',
        };
      }
      const percent = priceCents > 0 ? (commissionCents / priceCents) * 100 : 0;
      const netPerUnit = priceCents - commissionCents;
      return {
        valid: true,
        priceCents,
        commissionCents,
        percent: percent.toFixed(1),
        netPerUnit,
        sellerPer10: commissionCents * 10,
        storePer10: netPerUnit * 10,
      };
    } catch {
      return {
        valid: false,
        error: 'Digite valores válidos em reais (ex: 12,50).',
      };
    }
  }, [priceBRL, commissionBRL]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculationPreview.valid || isPending) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('seller_id', selectedSellerId);
        formData.set('variant_id', selectedVariantId);
        formData.set('price_cents', calculationPreview.priceCents!.toString());
        formData.set('commission_cents', calculationPreview.commissionCents!.toString());
        formData.set('active', active ? 'true' : 'false');

        const res = await saveSellerOfferAction(formData);
        setResult(res);
      } catch (err) {
        setResult({
          ok: false,
          message: err instanceof Error ? err.message : 'Falha ao salvar oferta.',
        });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="seller-modal-backdrop"
      onClick={() => { if (!isPending) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="offer-modal-title"
    >
      <div ref={modal} tabIndex={-1} className="seller-modal-card" onClick={e => e.stopPropagation()}>
        <div className="seller-modal-header">
          <h3 id="offer-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag size={20} color="var(--color-primary)" aria-hidden="true" />
            Configurar Oferta e Comissão
          </h3>
          <button type="button" className="icon-button" onClick={onClose} disabled={isPending} aria-label="Fechar janela">
            <X size={20} />
          </button>
        </div>

        <p className="muted" style={{ fontSize: 13 }}>
          Configure o preço de venda e a comissão por unidade deste produto para o vendedor. Salgados são registrados por porção.
        </p>

        {result && (
          <div
            role={result.ok ? 'status' : 'alert'}
            aria-live="polite"
            className={`form-message ${result.ok ? 'success' : 'error'}`}
          >
            {result.ok && <CheckCircle2 size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />}
            {result.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="commerce-form" aria-label="Configurar oferta e comissão">
          <fieldset disabled={isPending} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
            <label>
              Vendedor
              <select
                name="seller_id"
                value={selectedSellerId}
                onChange={e => handleSellerChange(e.target.value)}
                required
              >
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.location})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Produto e Variante
              <select
                name="variant_id"
                value={selectedVariantId}
                onChange={e => handleVariantChange(e.target.value)}
                required
              >
                {variants.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.product_name} · {v.variant_name} (Padrão: {formatMoney(v.sale_price_cents)})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Preço de venda (R$)
                <input
                  type="text"
                  name="price_reais"
                  inputMode="decimal"
                  value={priceBRL}
                  onChange={e => setPriceBRL(e.target.value)}
                  placeholder="Ex: 15,00"
                  required
                />
              </label>

              <label>
                Comissão por unidade (R$)
                <input
                  type="text"
                  name="commission_reais"
                  inputMode="decimal"
                  value={commissionBRL}
                  onChange={e => setCommissionBRL(e.target.value)}
                  placeholder="Ex: 2,50"
                  required
                />
              </label>
            </div>

            {/* Visualização de comissão antes de salvar */}
            {calculationPreview.valid ? (
              <div className="commission-preview-box" role="region" aria-label="Resumo da comissão calculada">
                <strong>Simulação da comissão antes de salvar:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                  <li>Preço final: <strong>{formatMoney(calculationPreview.priceCents!)}</strong></li>
                  <li>Comissão do vendedor: <strong>{formatMoney(calculationPreview.commissionCents!)}</strong> por unidade ({calculationPreview.percent}%)</li>
                  <li>Valor para a operação antes dos custos: <strong>{formatMoney(calculationPreview.netPerUnit!)}</strong> por unidade.</li>
                  <li>A cada 10 unidades: comissão de <strong>{formatMoney(calculationPreview.sellerPer10!)}</strong> · Operação recebe <strong>{formatMoney(calculationPreview.storePer10!)}</strong> antes dos custos.</li>
                </ul>
              </div>
            ) : (
              <div className="form-message error" style={{ margin: 0 }}>
                <AlertCircle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                {calculationPreview.error}
              </div>
            )}

            <label className="check-label">
              <input
                type="checkbox"
                name="active"
                checked={active}
                onChange={e => setActive(e.target.checked)}
              />
              Oferta ativa para novas vendas deste vendedor
            </label>

            <div className="commerce-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                className="action-button secondary"
                onClick={onClose}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="action-button"
                disabled={isPending || !calculationPreview.valid}
                aria-busy={isPending}
              >
                {isPending ? (
                  <>
                    <LoaderCircle className="loading-icon" size={16} />
                    Salvando oferta…
                  </>
                ) : (
                  'Salvar Oferta'
                )}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
