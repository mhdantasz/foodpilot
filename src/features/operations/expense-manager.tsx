'use client';
import { useRef,useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { PageHeader,EmptyState } from '@/components/ui';
import type { Expense } from '@/types/database';
import { saveExpense } from './actions';
import { centsToBRL,formatMoney } from '@/lib/money';
import { formatBusinessDate } from '@/lib/business-time';
export const expenseLabels={ingredients:'Ingredientes',packaging:'Embalagens',transport:'Transporte',fees:'Taxas',other:'Outros'};
function dateValue(value:string,timezone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=(type:string)=>parts.find(p=>p.type===type)!.value;return `${get('year')}-${get('month')}-${get('day')}`;}
function ExpenseEditor({record,timezone,onClose,onSaved}:{record?:Expense;timezone:string;onClose:()=>void;onSaved:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),key=useRef(''),lock=useRef(false),router=useRouter();
 return <form className="section-card commerce-form" aria-label="Despesa" onSubmit={async e=>{
  e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');if(!key.current)key.current=crypto.randomUUID();const f=new FormData(e.currentTarget);
  try{const r=await saveExpense({requestId:key.current,id:record?.id,description:String(f.get('description')),category:String(f.get('category')),amount:String(f.get('amount')),day:String(f.get('day')),notes:String(f.get('notes')??'')});if(r.error)setError(r.error);else{onSaved();router.refresh();}}catch{setError('Não foi possível confirmar. Tente novamente com os mesmos dados.');}finally{lock.current=false;setBusy(false);}
 }}><h2>{record?'Editar despesa':'Nova despesa'}</h2><fieldset disabled={busy}><label>Descrição<input name="description" defaultValue={record?.description} maxLength={200} required autoFocus/></label><div className="form-grid"><label>Valor<input name="amount" inputMode="decimal" defaultValue={record?centsToBRL(record.amount_cents):''} required placeholder="0,00"/></label><label>Data<input name="day" type="date" required defaultValue={dateValue(record?.incurred_at??new Date().toISOString(),timezone)}/></label></div><label>Categoria da despesa<select name="category" defaultValue={record?.category??'ingredients'}>{Object.entries(expenseLabels).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>Observações da despesa<textarea name="notes" maxLength={2000} defaultValue={record?.notes??''}/></label>{error&&<p role="alert" className="form-message error">{error}</p>}<div className="commerce-actions"><button className="action-button" type="submit">{busy?'Salvando…':'Salvar despesa'}</button><button className="action-button secondary" type="button" onClick={onClose}>Cancelar</button></div></fieldset>{busy&&<p role="status" className="sr-only">Salvando despesa</p>}</form>;
}
export function ExpenseManager({records,timezone,initialNew=false,children}:{records:Expense[];timezone:string;initialNew?:boolean;children?:ReactNode}){
 const [editor,setEditor]=useState<Expense|'new'|null>(initialNew?'new':null),[success,setSuccess]=useState('');
 return <><PageHeader title="Despesas" description="Custos da operação, separados do custo dos produtos vendidos." action={<button className="action-button" onClick={()=>{setEditor('new');setSuccess('');}}>Nova despesa</button>}/>{children}{success&&<p role="status" className="form-message success">{success}</p>}{editor&&<ExpenseEditor key={editor==='new'?'new':editor.id} record={editor==='new'?undefined:editor} timezone={timezone} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setSuccess('Despesa salva.');}}/>}
 {!records.length?<EmptyState icon={Wallet} title="Sem despesas neste período" description="Registre ingredientes, embalagens, transporte e outros gastos da operação."/>:<div className="commerce-list">{records.map(r=><article className="section-card commerce-record" key={r.id}><div><h2>{r.description}</h2><p>{expenseLabels[r.category]} · {formatBusinessDate(r.incurred_at,timezone,false)}</p>{r.notes&&<small className="preserve-lines">{r.notes}</small>}</div><strong>{formatMoney(r.amount_cents)}</strong><button className="action-button secondary" onClick={()=>setEditor(r)} aria-label={`Editar ${r.description}`}>Editar</button></article>)}</div>}</>;
}
