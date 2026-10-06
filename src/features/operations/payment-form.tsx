'use client';
import { useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordPayment } from './actions';
import { centsToBRL,formatMoney } from '@/lib/money';
import { receiptLabels } from '@/features/commerce/payments';
export function PaymentFeedback(){
 const [message,setMessage]=useState('');
 useEffect(()=>{const listener=(event:Event)=>setMessage((event as CustomEvent<string>).detail);window.addEventListener('pronto:payment-saved',listener);return ()=>window.removeEventListener('pronto:payment-saved',listener);},[]);
 return message?<p role="status" className="form-message success">{message}</p>:null;
}
export function PaymentForm({customerId,saleId,balance,settleAll=false}:{customerId:string;saleId?:string;balance:number;settleAll?:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const key=useRef(''),lock=useRef(false),router=useRouter();
 return <div className="payment-form"><button className="action-button" disabled={busy||balance<=0} onClick={()=>{if(!key.current)key.current=crypto.randomUUID();setOpen(!open);}}>{settleAll?'Quitar tudo':'Registrar pagamento'}</button>
 {message&&<p role="status" className="form-message success">{message}</p>}
 {open&&<form className="commerce-form" aria-label={settleAll?'Quitar todas as pendências':'Registrar pagamento'} onSubmit={async e=>{
  e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');const f=new FormData(e.currentTarget);
  try{const r=await recordPayment({requestId:key.current,customerId,saleId,amount:String(f.get('amount')),method:String(f.get('method')),notes:String(f.get('notes')??'')});
   if(r.error)setError(r.error);else{const success=`Pagamento de ${formatMoney(r.total!)} registrado.`;setMessage(success);window.dispatchEvent(new CustomEvent('pronto:payment-saved',{detail:success}));setOpen(false);key.current='';router.refresh();}
  }catch{setError('Não foi possível confirmar. Repita com os mesmos dados para verificar o pagamento.');}finally{setBusy(false);lock.current=false;}
 }}><fieldset disabled={busy}><p>Saldo disponível: <strong>{formatMoney(balance)}</strong>{settleAll&&' · O pagamento será distribuído entre as vendas mais antigas.'}</p><label>Valor recebido<input name="amount" inputMode="decimal" required defaultValue={centsToBRL(balance)} readOnly={settleAll}/></label><label>Forma de pagamento<select name="method">{Object.entries(receiptLabels).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label><label>Observações do pagamento (opcional)<textarea name="notes" maxLength={2000}/></label>{error&&<p role="alert" className="form-message error">{error}</p>}<div className="commerce-actions"><button className="action-button" type="submit">{busy?'Registrando…':'Confirmar pagamento'}</button><button className="action-button secondary" type="button" onClick={()=>setOpen(false)}>Cancelar</button></div></fieldset>{busy&&<p role="status" className="sr-only">Registrando pagamento</p>}</form>}
 </div>;
}
