'use client';
import Link from 'next/link';
import { startTransition, useRef, useState } from 'react';
import { Plus, Users, MapPin, Tags } from 'lucide-react';
import { ActionButton, EmptyState, PageHeader, SearchField, StatusBadge } from '@/components/ui';
import { saveSimple } from './actions';
import { formatMoney } from '@/lib/money';
import { formatBusinessDate } from '@/lib/business-time';
import type { Customer, TenantRow } from '@/types/database';

type Kind = 'customers' | 'categories' | 'locations';
export function SimpleEditor({ kind, record, onSaved, onCancel }: { kind: Kind; record?: TenantRow | Customer; onSaved: (id: string, record?: TenantRow | Customer) => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  const customer = record && 'phone' in record ? record : undefined;
  return <form className="commerce-form section-card" aria-label="Cadastro" onSubmit={async event => {
    event.preventDefault(); if (locked.current) return; locked.current = true; setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    startTransition(async () => { try {
      const result = await saveSimple(kind, { id: record?.id, name: String(data.get('name')), phone: String(data.get('phone') ?? ''), notes: String(data.get('notes') ?? ''), active: data.get('active') === 'on' });
      if (result.error) setError(result.error); else onSaved(result.id!, result.record);
    } catch { setError('Não foi possível salvar. Tente novamente.'); }
    finally { locked.current = false; setBusy(false); } });
  }}>
    <h2>{record ? 'Editar cadastro' : kind === 'customers' ? 'Novo cliente' : kind === 'categories' ? 'Nova categoria' : 'Novo local'}</h2>
    <fieldset disabled={busy}>
      <label>Nome<input name="name" required maxLength={100} defaultValue={record?.name} autoFocus /></label>
      {kind === 'customers' && <><label>Telefone (opcional)<input name="phone" type="tel" autoComplete="tel" maxLength={30} defaultValue={customer?.phone ?? ''} /></label><label>Observações (opcional)<textarea name="notes" maxLength={2000} defaultValue={customer?.notes ?? ''} /></label></>}
      <label className="check-label"><input name="active" type="checkbox" defaultChecked={record?.active ?? true} />Cadastro ativo</label>
      {error && <p role="alert" className="form-message error">{error}</p>}
      <div className="commerce-actions"><button type="submit" className="action-button">{busy ? 'Salvando…' : 'Salvar'}</button><button type="button" className="action-button secondary" onClick={onCancel}>Cancelar</button></div>
    </fieldset>
    {busy && <p className="sr-only" role="status">Salvando cadastro</p>}
  </form>;
}
export function SimpleManager({ kind, records, summaries = [], timezone, initialEdit, initialNew=false }: { kind: Kind; records: TenantRow[] | Customer[]; summaries?: { customer_id: string; total_cents: number; purchase_count: number; last_purchase: string }[]; timezone: string; initialEdit?:string; initialNew?:boolean }) {
  const [search, setSearch] = useState(''), [status, setStatus] = useState('active'), [editor, setEditor] = useState<TenantRow | 'new' | null>(()=>initialNew?'new':records.find(r=>r.id===initialEdit)??null);
  const title = kind === 'customers' ? 'Clientes' : kind === 'categories' ? 'Categorias' : 'Locais de venda';
  const [confirmed, setConfirmed] = useState<Record<string, TenantRow | Customer>>({});
  const [feedback,setFeedback]=useState('');
  // Só usamos linhas devolvidas pelo banco após salvar. Props mais novas prevalecem.
  const current = new Map(records.map(record => [record.id, record]));
  for (const saved of Object.values(confirmed)) {
    const incoming = current.get(saved.id);
    if (!incoming || incoming.updated_at < saved.updated_at) current.set(saved.id, saved);
  }
  const noun = kind === 'customers' ? 'cliente' : kind === 'categories' ? 'categoria' : 'local';
  const filtered = [...current.values()].filter(r => r.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (status === 'all' || r.active === (status === 'active')));
  return <><PageHeader title={title} description={kind === 'customers' ? 'Pessoas e compras, sem perder o cuidado.' : kind === 'categories' ? 'Organize seus produtos por categoria.' : 'Cadastre os lugares onde você vende.'} action={<button className="action-button" onClick={() => setEditor('new')}><Plus size={18} />{kind === 'categories' ? 'Nova' : 'Novo'} {noun}</button>} />
    {kind !== 'customers' && <div className="commerce-actions"><ActionButton secondary href="/produtos">Voltar aos produtos</ActionButton><ActionButton secondary href="/configuracoes">Configurações</ActionButton></div>}
    {feedback&&<p className="form-message success" role="status">{feedback}</p>}
    {editor && <SimpleEditor key={editor === 'new' ? 'new' : editor.id} kind={kind} record={editor === 'new' ? undefined : editor} onCancel={() => setEditor(null)} onSaved={(_id, saved) => { if (saved) setConfirmed(previous => ({ ...previous, [saved.id]: saved })); setFeedback(editor==='new'?(kind==='customers'?'Cliente criado.':'Cadastro criado.'):'Alterações salvas.');setEditor(null); }} />}
    <div className="commerce-filters"><SearchField value={search} onChange={setSearch} placeholder={`Buscar ${title.toLowerCase()}`} /><label>Status<select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="all">Todos</option></select></label></div>
    {!filtered.length ? <EmptyState title={search ? 'Nenhum resultado encontrado.' : `Nenhum ${noun} por aqui ainda`} description={search ? 'Tente outro nome.' : `Adicione seu primeiro ${noun} para começar.`} icon={kind === 'customers' ? Users : kind === 'categories' ? Tags : MapPin} /> : <div className="commerce-list">{filtered.map(r => {
      const summary = summaries.find(s => s.customer_id === r.id);
      return <article className="commerce-record section-card" key={r.id}><div><h2>{kind === 'customers' ? <Link className="text-link" href={`/clientes/${r.id}`}>{r.name}</Link> : r.name}</h2><StatusBadge tone={r.active ? 'success' : 'neutral'}>{r.active ? 'Ativo' : 'Inativo'}</StatusBadge></div>{kind === 'customers' && <div className="record-summary"><strong>{formatMoney(Number(summary?.total_cents ?? 0))}</strong><span>{summary?.purchase_count ?? 0} compras</span><small>{summary?.last_purchase ? `Última compra: ${formatBusinessDate(summary.last_purchase, timezone)}` : 'Ainda sem compras'}</small></div>}<button className="action-button secondary" onClick={() => setEditor(r)} aria-label={`Editar ${r.name}`}>Editar</button></article>;
    })}</div>}
  </>;
}
