'use client';

import { useState, useTransition } from 'react';
import { ShoppingCart, CheckCircle2, AlertCircle, LoaderCircle, CreditCard, Banknote, QrCode, MoreHorizontal, Package } from 'lucide-react';
import type { SellerOffer, SellerActionResult } from '@/lib/sellers/types';
import { formatMoney } from '@/lib/money';
import { recordSellerSaleAction } from '@/app/vendedor/actions';

export function SellerSaleForm({ offers }: { offers: SellerOffer[] }) {
  const activeOffers = offers.filter(o => o.active);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash' | 'other'>('pix');
  const [requestId, setRequestId] = useState('');
  const [result, setResult] = useState<SellerActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleQuantityChange = (offerId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[offerId] || 0;
      const next = Math.min(9999, Math.max(0, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[offerId];
        return copy;
      }
      return { ...prev, [offerId]: next };
    });
    // Limpar mensagem de sucesso ao iniciar nova digitação
    if (result?.ok) {
      setResult(null);
    }
  };

  const selectedItems = activeOffers
    .filter(o => (quantities[o.id] || 0) > 0)
    .map(o => ({
      offer_id: o.id,
      quantity: quantities[o.id] || 0,
      price_cents: o.price_cents,
      commission_cents: o.commission_cents,
      product_name: o.product_name,
      variant_name: o.variant_name,
    }));

  const totalUnits = selectedItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalCents = selectedItems.reduce((acc, item) => acc + item.quantity * item.price_cents, 0);
  const totalCommissionCents = selectedItems.reduce((acc, item) => acc + item.quantity * item.commission_cents, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0 || isPending) return;

    startTransition(async () => {
      try {
      const stableId = requestId || crypto.randomUUID();
      if (!requestId) setRequestId(stableId);
      const formData = new FormData();
      formData.set('request_id', stableId);
      formData.set('payment_method', paymentMethod);
      formData.set(
        'items',
        JSON.stringify(selectedItems.map(item => ({ offer_id: item.offer_id, quantity: item.quantity })))
      );

      const res = await recordSellerSaleAction(formData);
      setResult(res);

      if (res.ok) {
        // Limpar quantidades após sucesso
        setQuantities({});
        // Gerar nova chave UUID estável para a próxima venda
        setRequestId('');
      }
      // Se falhar, requestId e quantities são mantidos intactos para retry
      } catch {
        setResult({ ok: false, message: 'Não foi possível confirmar a resposta. Seus produtos e a identificação da venda foram mantidos; tente novamente antes de iniciar outra venda.' });
      }
    });
  };

  if (activeOffers.length === 0) {
    return (
      <section className="seller-sale-section" aria-labelledby="sale-form-title">
        <div className="empty-state">
          <div className="empty-icon">
            <Package size={30} aria-hidden="true" />
          </div>
          <h2 id="sale-form-title">Nenhuma oferta ativa no momento</h2>
          <p>
            O gerente ainda não configurou produtos e comissões para seu perfil. Assim que os produtos forem liberados, você poderá registrar vendas aqui.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="seller-sale-section" aria-labelledby="sale-form-title">
      <div className="seller-sale-heading">
        <h2 id="sale-form-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShoppingCart size={22} color="var(--color-primary)" aria-hidden="true" />
          Registrar nova venda
        </h2>
        <p>Selecione as quantidades vendidas, confirme o valor e o recebimento.</p>
      </div>

      {result && (
        <div
          role={result.ok ? 'status' : 'alert'}
          aria-live="polite"
          className={`form-message ${result.ok ? 'success' : 'error'}`}
          style={{ marginBottom: 20 }}
        >
          {result.ok ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={20} aria-hidden="true" />
              <div>
                <strong>{result.message}</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Pronto para a próxima venda! Os campos foram limpos.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={20} aria-hidden="true" />
              <div>
                <strong>Falha ao registrar venda:</strong> {result.message}
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Seus dados e produtos foram preservados. Você pode tentar novamente com a mesma chave.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} aria-label="Formulário de registro de venda">
        <input type="hidden" name="request_id" value={requestId} />

        <div className="seller-offer-grid">
          {activeOffers.map(offer => {
            const qty = quantities[offer.id] || 0;
            return (
              <div
                key={offer.id}
                className={`seller-offer-card ${qty > 0 ? 'has-quantity' : ''}`}
              >
                <div className="seller-offer-info">
                  <strong>
                    {offer.product_name} · {offer.variant_name}
                  </strong>
                  <div className="seller-offer-price">{formatMoney(offer.price_cents)}</div>
                  <div className="seller-offer-commission">
                    Sua comissão: {formatMoney(offer.commission_cents)} / un
                  </div>
                </div>

                <div className="seller-quantity-bar">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(offer.id, -1)}
                    disabled={qty === 0 || isPending}
                    className="seller-qty-btn"
                    aria-label={`Diminuir quantidade de ${offer.product_name} ${offer.variant_name}`}
                  >
                    −
                  </button>
                  <span className="seller-qty-value" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(offer.id, 1)}
                    disabled={isPending || qty >= 9999}
                    className="seller-qty-btn"
                    aria-label={`Aumentar quantidade de ${offer.product_name} ${offer.variant_name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="seller-sale-summary">
          <div className="seller-summary-totals">
            <div className="seller-summary-box">
              <span>Total da venda ({totalUnits} {totalUnits === 1 ? 'item' : 'itens'})</span>
              <strong>{formatMoney(totalCents)}</strong>
            </div>
            <div className="seller-summary-box commission">
              <span>Sua comissão nesta venda</span>
              <strong>{formatMoney(totalCommissionCents)}</strong>
            </div>
          </div>

          <fieldset className="seller-payment-selector" disabled={isPending} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>Forma de pagamento recebida</legend>
            <div className="seller-payment-grid">
              <button
                type="button"
                className="seller-payment-btn"
                aria-pressed={paymentMethod === 'pix'}
                onClick={() => setPaymentMethod('pix')}
              >
                <QrCode size={18} aria-hidden="true" />
                <span>Pix</span>
              </button>
              <button
                type="button"
                className="seller-payment-btn"
                aria-pressed={paymentMethod === 'card'}
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard size={18} aria-hidden="true" />
                <span>Cartão</span>
              </button>
              <button
                type="button"
                className="seller-payment-btn"
                aria-pressed={paymentMethod === 'cash'}
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote size={18} aria-hidden="true" />
                <span>Dinheiro</span>
              </button>
              <button
                type="button"
                className="seller-payment-btn"
                aria-pressed={paymentMethod === 'other'}
                onClick={() => setPaymentMethod('other')}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
                <span>Outro</span>
              </button>
            </div>
          </fieldset>

          <div className="seller-machine-notice">
            Atenção: O Food Pilot registra o lançamento da venda, mas <strong>não confirma transações bancárias nem da maquininha</strong>. Certifique-se de receber o dinheiro ou aguardar a aprovação na maquininha antes de entregar o produto.
          </div>

          <button
            type="submit"
            disabled={totalUnits === 0 || isPending}
            className="action-button seller-confirm-btn"
            aria-busy={isPending}
          >
            {isPending ? (
              <>
                <LoaderCircle className="loading-icon" size={20} />
                Gravando venda…
              </>
            ) : totalUnits === 0 ? (
              'Escolha os produtos acima'
            ) : (
              `Confirmar venda (${formatMoney(totalCents)})`
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
