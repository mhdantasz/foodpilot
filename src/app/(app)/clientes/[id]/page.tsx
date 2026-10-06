import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banknote, ShoppingBag, ChartNoAxesCombined, CalendarDays } from 'lucide-react';
import { PageHeader, ActionButton, SectionCard, StatCard } from '@/components/ui';
import { commerceContext, metrics, peopleData, salesData } from '@/features/commerce/data';
import { SalesList } from '@/features/commerce/sales-list';
import { formatMoney } from '@/lib/money';
import { formatBusinessDate } from '@/lib/business-time';
import { customerDebts,finances } from '@/features/operations/data';
import { PaymentForm,PaymentFeedback } from '@/features/operations/payment-form';
import { WhatsappButton } from '@/features/operations/whatsapp-button';
import { receiptLabels } from '@/features/commerce/payments';
export const metadata = { title: 'Perfil do cliente' };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const { id } = await params; const { client, business } = await commerceContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await client.from('customers').select('*').eq('business_id', business.id).eq('id', id).maybeSingle();
  if (result.error) throw new Error('Não foi possível carregar o cliente.'); if (!result.data) notFound(); const customer = result.data;
  const query = await searchParams; const page = Math.min(100000, Math.max(0, Number.parseInt(query.pagina ?? '0', 10) || 0));
  const [summary, sales, people, financial, debts] = await Promise.all([metrics('all', id), salesData('all', id, page), peopleData(),finances(),customerDebts(id,page)]);
  const f=financial.find(r=>r.customer_id===id)!;
  return <><PageHeader title={customer.name} description={customer.active ? 'Histórico e informações do cliente.' : 'Cliente inativo · Histórico preservado.'} action={<ActionButton secondary href="/clientes">Voltar aos clientes</ActionButton>} />
   <SectionCard title="Informações"><dl className="settings-list"><dt>Telefone</dt><dd>{customer.phone ?? 'Não informado'}</dd><dt>Observações</dt><dd className="preserve-lines">{customer.notes ?? 'Sem observações'}</dd></dl><WhatsappButton id={id} name={customer.name} phone={customer.phone} balance={f.balance_cents}/></SectionCard>
   <div className="stats-grid"><StatCard label="Total comprado" value={formatMoney(summary.revenue)} note="Todas as compras" icon={Banknote} accent/><StatCard label="Total pago" value={formatMoney(f.paid_cents)} note="Recebimentos registrados" icon={Banknote}/><StatCard label="Total pendente" value={formatMoney(f.balance_cents)} note="Saldo a receber" icon={Banknote}/><StatCard label="Compras" value={String(summary.count)} note="Pagas e fiados" icon={ShoppingBag}/><StatCard label="Ticket médio" value={formatMoney(summary.ticket)} note="Por compra" icon={ChartNoAxesCombined}/><StatCard label="Última compra" value={summary.last_purchase?formatBusinessDate(summary.last_purchase,business.timezone,false):'—'} note="Horário do negócio" icon={CalendarDays}/><StatCard label="Compras por semana" value={f.weekly_frequency===null?'Dados insuficientes':Number(f.weekly_frequency).toLocaleString('pt-BR',{maximumFractionDigits:1})} note="Janela de até 30 dias, incluindo dias sem compras" icon={ShoppingBag}/><StatCard label="Gasto médio semanal" value={f.weekly_spend_cents===null?'Dados insuficientes':formatMoney(f.weekly_spend_cents)} note="Pelo menos 14 dias e 2 compras na janela" icon={Banknote}/></div>
   <PaymentFeedback/><section id="pendencias"><SectionCard title="Pendências">{f.balance_cents>0 && <PaymentForm customerId={id} balance={f.balance_cents} settleAll/>}{!debts.sales.length?<p className="muted">Sem pendências nesta página.</p>:<div className="commerce-list">{debts.sales.map(s=><article className="debt-sale" key={s.id}><Link className="text-link" href={`/vendas/${s.id}`}>Venda #{s.id.slice(0,8)} · {formatBusinessDate(s.sold_at,business.timezone)}</Link><p>{debts.items.filter(i=>i.sale_id===s.id).map(i=>`${i.quantity} × ${i.product_name_snapshot} — ${i.variant_name_snapshot}`).join(' · ')}</p><dl className="debt-values"><div><dt>Valor original</dt><dd>{formatMoney(s.total_cents)}</dd></div><div><dt>Pago</dt><dd>{formatMoney(s.paid_cents)}</dd></div><div><dt>Saldo</dt><dd>{formatMoney(s.balance_cents)}</dd></div></dl><PaymentForm customerId={id} saleId={s.id} balance={s.balance_cents}/></article>)}</div>}</SectionCard></section>
   <SectionCard title="Histórico de pagamentos">{!debts.payments.length?<p className="muted">Nenhum pagamento nesta página.</p>:<div className="commerce-list">{debts.payments.map(p=><article className="operation-row" key={p.id}><div><Link className="text-link" href={`/vendas/${p.sale_id}`}>Venda #{p.sale_id.slice(0,8)}</Link><p>{formatBusinessDate(p.paid_at,business.timezone)} · {receiptLabels[p.payment_method]}</p>{p.notes&&<small>{p.notes}</small>}</div><strong>{formatMoney(p.amount_cents)}</strong></article>)}</div>}</SectionCard>
   <SectionCard title="Histórico de compras"><SalesList {...sales} {...people}/></SectionCard><nav className="commerce-actions" aria-label="Páginas do histórico">{page>0&&<Link className="action-button secondary" href={`?pagina=${page-1}`}>Anteriores</Link>}{(page+1)*50<Math.max(sales.count,debts.count,debts.paymentCount)&&<Link className="action-button secondary" href={`?pagina=${page+1}`}>Próximas</Link>}</nav></>;
}


