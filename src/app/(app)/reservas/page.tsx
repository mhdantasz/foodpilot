import Link from 'next/link';
import { PageHeader,ActionButton } from '@/components/ui';
import { reservations } from '@/features/operations/data';
import { commerceContext,peopleData } from '@/features/commerce/data';
import { ReservationList } from '@/features/operations/reservation-list';
export const metadata={title:'Reservas'};
export default async function Page({searchParams}:{searchParams:Promise<{periodo?:string;pagina?:string}>}){
 const q=await searchParams,period=['today','tomorrow','upcoming','all'].includes(q.periodo??'')?q.periodo!:'today',page=Math.min(100000,Math.max(0,parseInt(q.pagina??'0')||0));
 const [data,people,context]=await Promise.all([reservations(period,page),peopleData(),commerceContext()]);
 return <><PageHeader title="Reservas" description="Prepare os pedidos e transforme as entregas em vendas." action={<ActionButton href="/reservas/nova">Nova reserva</ActionButton>}/><nav className="commerce-actions" aria-label="Período das reservas">{Object.entries({today:'Hoje',tomorrow:'Amanhã',upcoming:'Próximas',all:'Todas'}).map(([v,t])=><Link className={`action-button ${v===period?'':'secondary'}`} href={`?periodo=${v}`} key={v}>{t}</Link>)}</nav><ReservationList {...data} {...people} timezone={context.business.timezone}/><nav className="commerce-actions" aria-label="Páginas de reservas">{page>0&&<Link href={`?periodo=${period}&pagina=${page-1}`} className="text-link">Anteriores</Link>}{(page+1)*50<data.count&&<Link href={`?periodo=${period}&pagina=${page+1}`} className="text-link">Próximas</Link>}</nav></>;
}
