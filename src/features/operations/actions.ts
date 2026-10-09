'use server';
import { revalidatePath } from 'next/cache';
import { commerceContext } from '@/features/commerce/data';
import { brlToCents } from '@/lib/money';
import type { Result } from '@/features/commerce/actions';
import type { PostgrestError } from '@supabase/supabase-js';
import type { Reservation,SaleBalance } from '@/types/database';
const uuid=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
function failed(error:PostgrestError):Result{return {error:error.code==='22023'?error.message:'Não foi possível confirmar. Tente novamente com os mesmos dados para verificar o registro.'};}
function changed(){revalidatePath('/','layout');}
export async function cancelSale(id:string,reason:string,refundConfirmed:boolean):Promise<Result & {sale?:SaleBalance}>{
 const {client}=await commerceContext();
 if(!uuid(id)||typeof reason!=='string'||reason.trim().length<5||reason.length>500||typeof refundConfirmed!=='boolean')return {error:'Informe o motivo do cancelamento, entre 5 e 500 caracteres.'};
 try{const r=await client.rpc('cancel_sale',{p_id:id,p_reason:reason.trim(),p_refund_confirmed:refundConfirmed});if(r.error)return failed(r.error);const saved=await client.from('sale_balances').select('*').eq('id',id).single();if(saved.error)return {error:'A confirmação não chegou. Confira o histórico antes de repetir.'};changed();return {id:r.data!,sale:saved.data};}catch{return {error:'Não foi possível confirmar. Confira o histórico antes de repetir.'};}
}
export async function recordPayment(input:{requestId:string;customerId:string;saleId?:string;amount:string;method:string;notes:string}):Promise<Result>{
 const {client}=await commerceContext();
 try{
  if(!uuid(input.requestId)||!uuid(input.customerId)||(input.saleId&&!uuid(input.saleId))||!['pix','cash','card','other'].includes(input.method)||input.notes.length>2000) return {error:'Revise o cliente e o pagamento.'};
  const amount=brlToCents(input.amount);if(amount<=0)return {error:'Informe um valor maior que zero.'};
  const r=await client.rpc('record_payment',{p_request_id:input.requestId,p_customer_id:input.customerId,p_sale_id:input.saleId||null,p_amount_cents:amount,p_method:input.method,p_notes:input.notes.trim()||null});
  if(r.error)return failed(r.error);changed();return {total:amount,id:input.requestId};
 }catch{return {error:'Confira o valor. Se a conexão falhou, repita com os mesmos dados para verificar o pagamento.'};}
}
export async function createReservation(input:{requestId:string;items:{variant_id:string;quantity:number}[];customerId:string;locationId:string;scheduled:string;notes:string}):Promise<Result>{
 const {client}=await commerceContext();
 if(!uuid(input.requestId)||!uuid(input.customerId)||(input.locationId&&!uuid(input.locationId))||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.scheduled)||input.notes.length>2000||!Array.isArray(input.items)||!input.items.length||input.items.length>100||input.items.some(i=>!uuid(i.variant_id)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>9999))return {error:'Escolha um cliente, a data e os produtos da reserva.'};
 try{
  const r=await client.rpc('create_reservation',{p_request_id:input.requestId,p_items:input.items.map(i=>({variant_id:i.variant_id,quantity:i.quantity})),p_customer_id:input.customerId,p_location_id:input.locationId||null,p_scheduled_local:input.scheduled,p_notes:input.notes.trim()||null});
  if(r.error)return failed(r.error);
  const saved=await client.from('reservations').select('total_cents').eq('id',r.data!).single();
  if(saved.error)return {error:'A confirmação não chegou. Repita com os mesmos dados para verificar a mesma reserva.'};
  changed();return {id:r.data!,total:saved.data.total_cents};
 }catch{return {error:'Não foi possível confirmar a reserva. Repita com os mesmos dados para verificar.'};}
}
export async function changeReservation(id:string,status:string,method?:string):Promise<Result & { reservation?: Reservation }>{
 const {client}=await commerceContext();
 if(!uuid(id)||!['prepared','delivered','cancelled','converted'].includes(status)||(status==='converted'&&!['pix','cash','card','credit','other'].includes(method??'')))return {error:'Revise a reserva e a forma de pagamento.'};
 try{const r=await client.rpc('change_reservation',{p_id:id,p_status:status,p_method:method??null});if(r.error)return failed(r.error);const saved=await client.from('reservations').select('*').eq('id',id).single();if(saved.error)return {error:'A confirmação não chegou. Recarregue para verificar o estado da reserva antes de repetir.'};changed();return {id:r.data!,reservation:saved.data};}catch{return {error:'Não foi possível confirmar. Tente novamente; a conversão não duplica a venda.'};}
}
export async function saveExpense(input:{requestId:string;id?:string;description:string;category:string;amount:string;day:string;notes:string}):Promise<Result>{
 const {client}=await commerceContext();
 try{
  if(!uuid(input.requestId)||(input.id&&!uuid(input.id))||!input.description.trim()||input.description.trim().length>200||!['ingredients','packaging','transport','fees','other'].includes(input.category)||!/^\d{4}-\d{2}-\d{2}$/.test(input.day)||input.notes.length>2000)return {error:'Revise a descrição, a data e a categoria.'};
  const amount=brlToCents(input.amount);if(amount<=0)return {error:'Informe um valor maior que zero.'};
  const r=await client.rpc('save_expense',{p_request_id:input.requestId,p_id:input.id??null,p_description:input.description.trim(),p_category:input.category,p_amount_cents:amount,p_day:input.day,p_notes:input.notes.trim()||null});
  if(r.error)return failed(r.error);changed();return {id:r.data!};
 }catch{return {error:'Confira o valor. Se a conexão falhou, tente novamente com os mesmos dados.'};}
}
