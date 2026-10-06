import Link from 'next/link';
import { expenses,operationalMetrics } from '@/features/operations/data';
import { commerceContext } from '@/features/commerce/data';
import { ExpenseManager } from '@/features/operations/expense-manager';
import { formatMoney } from '@/lib/money';
export const metadata={title:'Despesas'};
export default async function Page({searchParams}:{searchParams:Promise<{periodo?:string;pagina?:string;novo?:string}>}){
 const q=await searchParams,period=['today','7days','30days','month'].includes(q.periodo??'')?q.periodo!:'month',page=Math.min(100000,Math.max(0,parseInt(q.pagina??'0')||0));
 const [data,context,summary]=await Promise.all([expenses(period,page),commerceContext(),operationalMetrics(period)]);
 return <><ExpenseManager {...data} timezone={context.business.timezone} initialNew={q.novo==='1'}><nav className="commerce-actions" aria-label="Período das despesas">{Object.entries({today:'Hoje','7days':'7 dias','30days':'30 dias',month:'Mês atual'}).map(([v,t])=><Link className={`action-button ${v===period?'':'secondary'}`} href={`?periodo=${v}`} key={v}>{t}</Link>)}</nav><p className="section-card">Despesas do período: <strong>{formatMoney(summary.expenses)}</strong></p></ExpenseManager><nav className="commerce-actions" aria-label="Páginas de despesas">{page>0&&<Link className="text-link" href={`?periodo=${period}&pagina=${page-1}`}>Anteriores</Link>}{(page+1)*50<data.count&&<Link className="text-link" href={`?periodo=${period}&pagina=${page+1}`}>Próximas</Link>}</nav></>;
}

