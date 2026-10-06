'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Banknote,Users,CheckCircle2 } from 'lucide-react';
import { PageHeader,StatCard,EmptyState,SearchField } from '@/components/ui';
import type { CustomerFinance } from '@/types/database';
import { formatMoney,sumCents } from '@/lib/money';
import { WhatsappButton } from './whatsapp-button';
export function DebtList({records}:{records:CustomerFinance[]}){
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
 const debtors=records.filter(r=>r.balance_cents>0).sort((a,b)=>b.pending_days-a.pending_days||b.balance_cents-a.balance_cents||a.customer_id.localeCompare(b.customer_id));
 const shown=debtors.filter(r=>r.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))&&(filter==='all'||(filter==='old'?r.pending_days>=30:r.pending_days<30)));
 return <><PageHeader title="Fiados" description="Pendências e recebimentos, com histórico preservado."/><div className="stats-grid"><StatCard label="Total a receber" value={formatMoney(sumCents(debtors.map(r=>r.balance_cents)))} note="Todas as vendas em aberto" icon={Banknote} accent/><StatCard label="Clientes devendo" value={String(debtors.length)} note="Clientes com saldo pendente" icon={Users}/></div><div className="commerce-filters"><SearchField value={search} onChange={setSearch} placeholder="Buscar cliente"/><label>Pendências<select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Pendências"><option value="all">Todos</option><option value="recent">Recentes · menos de 30 dias</option><option value="old">Mais antigos · 30 dias ou mais</option></select></label></div>
 {!shown.length?<EmptyState icon={CheckCircle2} title={debtors.length?'Nenhum cliente neste filtro':'Sem pendências'} description={debtors.length?'Tente outro nome ou período.':'Todas as vendas estão pagas. Os próximos fiados aparecerão aqui.'}/>:<div className="commerce-list">{shown.map(r=><article className="section-card commerce-record" key={r.customer_id}><div><Link className="text-link" href={`/clientes/${r.customer_id}#pendencias`}><h2>{r.name}</h2></Link><p>{r.open_sales} vendas em aberto</p><small>Pendência mais antiga: {r.pending_days===0?'hoje':`há ${r.pending_days} dias`}</small></div><div className="record-summary"><strong>{formatMoney(r.balance_cents)}</strong><span>pendentes</span></div><div className="operation-actions"><Link className="action-button" href={`/clientes/${r.customer_id}#pendencias`}>Ver pendências</Link><WhatsappButton id={r.customer_id} name={r.name} phone={r.phone} balance={r.balance_cents}/></div></article>)}</div>}</>;
}
