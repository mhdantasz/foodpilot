import { NextRequest } from 'next/server';
import { commerceContext } from '@/features/commerce/data';
import { csvDocument } from '@/lib/csv';
import { formatBusinessDate } from '@/lib/business-time';
import { paymentLabels,paymentStatusLabels } from '@/features/commerce/payments';
const headers={ 'Cache-Control':'private, no-store, max-age=0', 'X-Content-Type-Options':'nosniff' };
export async function GET(request:NextRequest){
 const {client,business}=await commerceContext();
 const type=request.nextUrl.searchParams.get('tipo')??'sales',period=request.nextUrl.searchParams.get('periodo')??'month';
 if(!['sales','customers','payments','expenses'].includes(type)||!['today','7days','30days','month','all'].includes(period))return Response.json({error:'Escolha os dados e um período válido.'},{status:400,headers});
 const snapshot=new Date().toISOString(), date=(value:string|null)=>value?formatBusinessDate(value,business.timezone):'';
 const bounds=period==='all'?null:await client.rpc('sales_period',{p_period:period,p_anchor:snapshot});
 if(bounds?.error|| (bounds&&!bounds.data?.[0]))return Response.json({error:'Não foi possível consultar o período. Tente novamente.'},{status:503,headers});
 // Paginação por UUID evita deslocamento de offsets durante inclusão de novas linhas.
 async function collect<Row extends {id:string}>(fetch:(cursor:string|null)=>PromiseLike<{data:Row[]|null;error:unknown}>){
  const rows:Row[]=[];let cursor:string|null=null;
  for(let page=0;page<=10;page++){const r=await fetch(cursor);if(r.error||!r.data)throw Error('unavailable');rows.push(...r.data);if(rows.length>10000)throw Error('limit');if(r.data.length<1000)return rows;cursor=r.data.at(-1)!.id;}
  throw Error('limit');
 }
 try{
  let columns:string[],rows:(string|number|null)[][];
  if(type==='sales'){
   const data=await collect(cursor=>{let q=client.from('sale_balances').select('*').eq('business_id',business.id).lte('created_at',snapshot).order('id').limit(1000);if(cursor)q=q.gt('id',cursor);if(bounds?.data?.[0]){const {starts_at,ends_at}=bounds.data[0];q=q.or(`and(sold_at.gte.${starts_at},sold_at.lt.${ends_at}),and(cancelled_at.gte.${starts_at},cancelled_at.lt.${ends_at})`);}return q;});
   columns=['Venda ID','Data','Cliente ID','Local ID','Pagamento','Situação','Situação do pagamento','Valor original (R$)','Custo original (R$)','Lucro original (R$)','Recebido original (R$)','Estornado (R$)','Saldo (R$)','Cancelamento','Motivo','Responsável ID'];
   rows=data.map(s=>[s.id,date(s.sold_at),s.customer_id,s.location_id,paymentLabels[s.payment_method],s.status==='cancelled'?'Cancelada':'Ativa',paymentStatusLabels[s.payment_status],s.total_cents/100,s.cost_total_cents/100,s.profit_cents/100,s.paid_cents/100,s.refunded_cents/100,s.balance_cents/100,date(s.cancelled_at),s.cancellation_reason,s.cancelled_by]);
  }else if(type==='customers'){
   const data=await collect(cursor=>{let q=client.from('customers').select('*').eq('business_id',business.id).lte('created_at',snapshot).order('id').limit(1000);if(cursor)q=q.gt('id',cursor);if(bounds?.data?.[0])q=q.gte('created_at',bounds.data[0].starts_at).lt('created_at',bounds.data[0].ends_at);return q;});
   columns=['Cliente ID','Nome','Telefone','Observações','Situação','Cadastrado em'];rows=data.map(c=>[c.id,c.name,c.phone,c.notes,c.active?'Ativo':'Inativo',date(c.created_at)]);
  }else if(type==='payments'){
   const data=await collect(cursor=>{let q=client.from('payments').select('*').eq('business_id',business.id).lte('created_at',snapshot).order('id').limit(1000);if(cursor)q=q.gt('id',cursor);if(bounds?.data?.[0])q=q.gte('paid_at',bounds.data[0].starts_at).lt('paid_at',bounds.data[0].ends_at);return q;});
   const cancelled=new Set<string>();for(let start=0;start<data.length;start+=100){const ids=[...new Set(data.slice(start,start+100).map(p=>p.sale_id))];const r=await client.from('sales').select('id').eq('business_id',business.id).eq('status','cancelled').in('id',ids);if(r.error)throw Error('unavailable');for(const row of r.data)cancelled.add(row.id);}
   columns=['Recibo ID','Venda ID','Cliente ID','Recebido em','Valor original (R$)','Pagamento','Observações','Situação da venda'];rows=data.map(p=>[p.id,p.sale_id,p.customer_id,date(p.paid_at),p.amount_cents/100,paymentLabels[p.payment_method],p.notes,cancelled.has(p.sale_id)?'Cancelada · consultar estorno em vendas':'Ativa']);
  }else{
   const data=await collect(cursor=>{let q=client.from('expenses').select('*').eq('business_id',business.id).lte('created_at',snapshot).order('id').limit(1000);if(cursor)q=q.gt('id',cursor);if(bounds?.data?.[0])q=q.gte('incurred_at',bounds.data[0].starts_at).lt('incurred_at',bounds.data[0].ends_at);return q;});
   const category={ingredients:'Ingredientes',packaging:'Embalagens',transport:'Transporte',fees:'Taxas',other:'Outros'};
   columns=['Despesa ID','Descrição','Categoria','Valor (R$)','Data','Observações'];rows=data.map(e=>[e.id,e.description,category[e.category],e.amount_cents/100,date(e.incurred_at),e.notes]);
  }
  return new Response(csvDocument(columns,rows),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${type}-${period}-${snapshot.slice(0,10)}.csv"`}});
 }catch(error){const limit=error instanceof Error&&error.message==='limit';return Response.json({error:limit?'Há mais de 10.000 registros. Escolha um período menor para exportar sem perder dados.':'Não foi possível exportar agora. Confira sua conexão e tente novamente.'},{status:limit?422:503,headers});}
}
