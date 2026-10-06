import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { EmptyState, ActionButton } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { formatBusinessDate } from '@/lib/business-time';
import { paymentLabels,paymentStatusLabels } from './payments';
import type { Sale, SaleItem, Customer, Location } from '@/types/database';
export function SalesList({ sales, items, customers, locations, timezone }: { sales: Sale[]; items: SaleItem[]; customers: Customer[]; locations: Location[]; timezone: string }) {
  if (!sales.length) return <EmptyState icon={ShoppingBag} title="Nenhuma venda neste período" description="Quando você registrar uma venda, ela aparecerá aqui." action={<ActionButton href="/vendas/nova">Nova venda</ActionButton>} />;
  return <div className="commerce-list">{sales.map(s => <article className="section-card sale-history-row" key={s.id}><div><Link className="text-link" href={`/vendas/${s.id}`}><strong>Venda #{s.id.slice(0, 8)}</strong></Link><p>{formatBusinessDate(s.sold_at, timezone)}</p><p>{customers.find(c => c.id === s.customer_id)?.name ?? (s.customer_id ? 'Cliente cadastrado' : 'Venda rápida')}</p></div><div><p>{items.filter(i => i.sale_id === s.id).map(i => `${i.quantity} × ${i.product_name_snapshot}${i.variant_name_snapshot === 'Tradicional' ? '' : ` — ${i.variant_name_snapshot}`}`).join(' · ')}</p><small>{locations.find(l => l.id === s.location_id)?.name ?? 'Sem local'} · {paymentLabels[s.payment_method]} · {paymentStatusLabels[s.payment_status]}</small></div><div className="record-summary"><strong>{formatMoney(s.total_cents)}</strong><small>Lucro bruto {formatMoney(s.profit_cents)}</small><Link className="text-link" href={`/vendas/${s.id}`}>Ver venda</Link></div></article>)}</div>;
}

