import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader, ActionButton } from '@/components/ui';
import { peopleData, salesData } from '@/features/commerce/data';
import { SalesList } from '@/features/commerce/sales-list';
export const metadata = { title: 'Vendas' };
export default async function Page({ searchParams }: { searchParams: Promise<{ periodo?: string; pagina?: string; acao?: string; cliente?: string }> }) {
  const params = await searchParams;
  if (params.acao === 'nova') redirect('/vendas/nova');
  const period = ['today', '7days', '30days'].includes(params.periodo ?? '') ? params.periodo! : 'today';
  const page = Math.min(100000, Math.max(0, Number.parseInt(params.pagina ?? '0', 10) || 0));
  const customerId = /^[0-9a-f-]{36}$/i.test(params.cliente ?? '') ? params.cliente : undefined;
  const [data, people] = await Promise.all([salesData(period, customerId, page), peopleData()]);
  function href(next: number) { const q = new URLSearchParams({ periodo: period, pagina: String(next) }); if (customerId) q.set('cliente', customerId); return `/vendas?${q}`; }
  return <><PageHeader title="Vendas" description="Cada venda registrada, com seus valores preservados." action={<ActionButton href="/vendas/nova">Nova venda</ActionButton>} /><form className="commerce-filters" method="get"><label>Período<select aria-label="Período" name="periodo" defaultValue={period}><option value="today">Hoje</option><option value="7days">7 dias</option><option value="30days">30 dias</option></select></label><label>Cliente<select aria-label="Cliente" name="cliente" defaultValue={customerId ?? ''}><option value="">Todos os clientes</option>{people.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="action-button secondary" type="submit">Filtrar</button></form><p className="muted commerce-count">{data.count} vendas · Horário do negócio</p><SalesList {...data} {...people} /><nav className="commerce-actions" aria-label="Páginas de vendas">{page > 0 && <Link className="action-button secondary" href={href(page - 1)}>Anteriores</Link>}{(page + 1) * 50 < data.count && <Link className="action-button secondary" href={href(page + 1)}>Próximas</Link>}</nav></>;
}
