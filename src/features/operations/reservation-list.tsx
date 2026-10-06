'use client';
import Link from 'next/link';
import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { EmptyState,ActionButton,StatusBadge } from '@/components/ui';
import type { Reservation,ReservationItem,Customer,Location } from '@/types/database';
import { changeReservation } from './actions';
import { formatMoney } from '@/lib/money';
import { formatBusinessDate } from '@/lib/business-time';
import { paymentLabels } from '@/features/commerce/payments';
const statusLabels={reserved:'Reservada',prepared:'Preparada',delivered:'Entregue',converted:'Convertida em venda',cancelled:'Cancelada'};
function ReservationCard({record:r,items,customers,locations,timezone}:{record:Reservation;items:ReservationItem[];customers:Customer[];locations:Location[];timezone:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[convert,setConvert]=useState(false),[cancel,setCancel]=useState(false),[method,setMethod]=useState('pix');
 const lock=useRef(false),router=useRouter();
 async function change(status:string){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const result=await changeReservation(r.id,status,status==='converted'?method:undefined);if(result.error)setError(result.error);else{setSuccess(status==='converted'?'Venda registrada.':'Reserva atualizada.');setCancel(false);setConvert(false);router.refresh();}}catch{setError('Não foi possível confirmar. Tente novamente.');}finally{setBusy(false);lock.current=false;}}
 return <article className="section-card reservation-card" data-testid="reservation-card"><header><div><h2>{customers.find(c=>c.id===r.customer_id)?.name??'Cliente cadastrado'}</h2><p>{formatBusinessDate(r.scheduled_for,timezone)}</p><small>{locations.find(l=>l.id===r.location_id)?.name??'Sem local'}</small></div><StatusBadge tone={r.status==='converted'?'success':'neutral'}>{statusLabels[r.status]}</StatusBadge></header><ul>{items.filter(i=>i.reservation_id===r.id).map(i=><li key={i.id}>{i.quantity} × {i.product_name_snapshot} — {i.variant_name_snapshot}</li>)}</ul><strong>{formatMoney(r.total_cents)}</strong>{r.notes&&<p className="preserve-lines">{r.notes}</p>}
 {r.converted_sale_id?<Link className="action-button secondary" href={`/vendas/${r.converted_sale_id}`}>Ver venda</Link>:r.status!=='cancelled'&&<fieldset className="commerce-form" disabled={busy}><div className="commerce-actions">{r.status==='reserved'&&<button className="action-button secondary" onClick={()=>change('prepared')}>Marcar preparada</button>}{['reserved','prepared'].includes(r.status)&&<button className="action-button secondary" onClick={()=>change('delivered')}>Marcar entregue</button>}<button className="action-button" onClick={()=>{setConvert(!convert);setCancel(false);}}>Converter em venda</button><button className="action-button secondary" onClick={()=>{setCancel(!cancel);setConvert(false);}}>Cancelar reserva</button></div>{convert&&<div className="commerce-form"><p>Os preços e custos combinados na reserva serão preservados.</p><label>Pagamento da venda<select value={method} onChange={e=>setMethod(e.target.value)}>{Object.entries(paymentLabels).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><button className="action-button" onClick={()=>change('converted')}>Confirmar conversão</button></div>}{cancel&&<div className="commerce-form"><p>Cancelar esta reserva? Nenhuma venda será registrada.</p><button className="action-button secondary" onClick={()=>change('cancelled')}>Confirmar cancelamento</button></div>}</fieldset>}
 {error&&<p role="alert" className="form-message error">{error}</p>}{success&&<p role="status" className="form-message success">{success}</p>}{busy&&<p role="status">Salvando…</p>}</article>;
}
export function ReservationList(props:{records:Reservation[];items:ReservationItem[];customers:Customer[];locations:Location[];timezone:string}){
 if(!props.records.length)return <EmptyState icon={CalendarDays} title="Sem reservas neste período" description="Combine pedidos com seus clientes e organize as próximas entregas." action={<ActionButton href="/reservas/nova">Nova reserva</ActionButton>}/>;
 return <div className="reservation-grid">{props.records.map(r=><ReservationCard key={r.id} record={r} {...props}/>)}</div>;
}
