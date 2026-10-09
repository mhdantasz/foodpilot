import { notFound } from 'next/navigation';
import { PageHeader, ActionButton, SectionCard } from '@/components/ui';
import { commerceContext } from '@/features/commerce/data';
import { paymentLabels,paymentStatusLabels } from '@/features/commerce/payments';
import { PaymentFeedback } from '@/features/operations/payment-form';
import { formatMoney } from '@/lib/money';
import { formatBusinessDate } from '@/lib/business-time';
import { SaleFinancialSummary } from '@/features/operations/cancel-sale';
export const metadata = { title: 'Detalhe da venda' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { client, business, membership } = await commerceContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await client.from('sale_balances').select('*').eq('business_id', business.id).eq('id', id).maybeSingle();
  if (result.error) throw new Error('Não foi possível carregar a venda.');
  if (!result.data) notFound(); const sale = result.data;
  const [items, customer, location] = await Promise.all([
    client.from('sale_items').select('*').eq('business_id', business.id).eq('sale_id', id).order('created_at').order('id'),
    sale.customer_id ? client.from('customers').select('name,id').eq('business_id', business.id).eq('id', sale.customer_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    sale.location_id ? client.from('locations').select('name').eq('business_id', business.id).eq('id', sale.location_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (items.error || customer.error || location.error) throw new Error('Não foi possível carregar os itens.');
  return <><PageHeader title={`Venda #${id.slice(0, 8)}`} description={formatBusinessDate(sale.sold_at, business.timezone)} action={<ActionButton secondary href="/vendas">Voltar às vendas</ActionButton>} /><PaymentFeedback/><SectionCard title="Registro original"><dl className="settings-list"><dt>Cliente</dt><dd>{customer.data?.name ?? 'Venda rápida'}</dd><dt>Local</dt><dd>{location.data?.name ?? 'Sem local'}</dd><dt>Pagamento</dt><dd>{paymentLabels[sale.payment_method]} · {paymentStatusLabels[sale.payment_status]}</dd></dl>{sale.notes && <p className="preserve-lines">{sale.notes}</p>}</SectionCard><SectionCard title="Itens da venda"><div className="commerce-list">{items.data!.map(i => <article className="sale-detail-item" key={i.id}><div><strong>{i.product_name_snapshot}{i.variant_name_snapshot !== 'Tradicional' && ` — ${i.variant_name_snapshot}`}</strong><p>{i.quantity} × {formatMoney(i.unit_price_cents)}</p></div><strong>{formatMoney(i.line_total_cents)}</strong></article>)}</div></SectionCard><SaleFinancialSummary sale={sale} timezone={business.timezone} owner={membership.role==='owner'}/><div className="commerce-actions"><ActionButton href="/vendas/nova">Nova venda</ActionButton><ActionButton secondary href="/">Voltar ao início</ActionButton></div></>;
}


