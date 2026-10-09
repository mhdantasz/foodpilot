'use client';
import { startTransition, useRef, useState } from 'react';
import { Plus, Package } from 'lucide-react';
import { ActionButton, EmptyState, PageHeader, SearchField, StatusBadge } from '@/components/ui';
import { saveProduct, toggleProduct } from './actions';
import { centsToBRL, formatMoney } from '@/lib/money';
import type { Category, Product, Variant } from '@/types/database';
type Draft = { id?: string; name: string; price: string; cost: string; active: boolean };
function ProductEditor({ product, variants, categories, onClose }: { product?: Product; variants: Variant[]; categories: Category[]; onClose: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(variants.length ? variants.map(v => ({ id: v.id, name: v.name, price: centsToBRL(v.sale_price_cents), cost: centsToBRL(v.cost_price_cents), active: v.active })) : [{ name: 'Tradicional', price: '', cost: '', active: true }]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const locked = useRef(false);
  function patch(index: number, values: Partial<Draft>) { setDrafts(old => old.map((d, i) => i === index ? { ...d, ...values } : d)); }
  return <form aria-label="Produto" className="commerce-form section-card" onSubmit={async e => {
    e.preventDefault(); if (locked.current) return; locked.current = true; setBusy(true); setError(''); const data = new FormData(e.currentTarget);
    startTransition(async () => { try {
      const result = await saveProduct({ id: product?.id, name: String(data.get('name')), categoryId: String(data.get('category')), description: String(data.get('description')), active: data.get('active') === 'on', variants: drafts });
      if (result.error) setError(result.error); else onClose();
    } catch { setError('Não foi possível salvar o produto. Tente novamente.'); } finally { locked.current = false; setBusy(false); } });
  }}><h2>{product ? 'Editar produto' : 'Novo produto'}</h2><fieldset disabled={busy}>
    <div className="form-grid"><label>Nome do produto<input name="name" defaultValue={product?.name} required maxLength={100} autoFocus /></label><label>Categoria<select aria-label="Categoria" name="category" defaultValue={product?.category_id ?? ''}><option value="">Sem categoria</option>{categories.filter(c => c.active || c.id === product?.category_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    <label>Descrição (opcional)<textarea name="description" defaultValue={product?.description ?? ''} maxLength={2000} /></label>
    <label className="check-label"><input name="active" type="checkbox" defaultChecked={product?.active ?? true} />Produto ativo</label>
    <h3>Sabores e opções</h3><p className="muted">Sem sabores? Mantenha “Tradicional”. Informe os valores em reais, como 12,50.</p>
    {drafts.map((d, i) => <div className="variant-editor" key={d.id ?? i}><label>Sabor {i + 1}<input required maxLength={100} value={d.name} onChange={e => patch(i, { name: e.target.value })} /></label><label>Preço de venda {i + 1}<input required inputMode="decimal" placeholder="12,00" value={d.price} onChange={e => patch(i, { price: e.target.value })} /></label><label>Custo {i + 1}<input required inputMode="decimal" placeholder="4,30" value={d.cost} onChange={e => patch(i, { cost: e.target.value })} /></label><label className="check-label"><input type="checkbox" checked={d.active} onChange={e => patch(i, { active: e.target.checked })} />Disponível</label>{!d.id && drafts.length > 1 && <button type="button" className="text-link" onClick={() => setDrafts(old => old.filter((_, n) => n !== i))}>Remover opção {i + 1}</button>}</div>)}
    <button type="button" className="action-button secondary" disabled={drafts.length >= 50} onClick={() => setDrafts(old => [...old, { name: '', price: '', cost: '', active: true }])}><Plus size={16} />Adicionar sabor</button>
    {error && <p className="form-message error" role="alert">{error}</p>}
    <div className="commerce-actions"><button className="action-button" type="submit">{busy ? 'Salvando…' : 'Salvar produto'}</button><button className="action-button secondary" type="button" onClick={onClose}>Cancelar</button></div>
  </fieldset>{busy && <p role="status" className="sr-only">Salvando produto</p>}</form>;
}
export function Catalog({ products, variants, categories }: { products: Product[]; variants: Variant[]; categories: Category[] }) {
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [status, setStatus] = useState('active'), [editor, setEditor] = useState<Product | 'new' | null>(null), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<Record<string, Product>>({});
  const locked = useRef(false);
  const current = products.map(product => confirmed[product.id]?.updated_at > product.updated_at ? confirmed[product.id] : product);
  const filtered = current.filter(p => (p.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) || variants.some(v => v.product_id === p.id && v.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))) && (!category || p.category_id === category) && (status === 'all' || p.active === (status === 'active')));
  function close() { setEditor(null); }
  return <><PageHeader title="Produtos" description="Seu catálogo, com preços e custos organizados." action={<button className="action-button" onClick={() => setEditor('new')}><Plus size={18} />Novo produto</button>} /><div className="commerce-actions"><ActionButton secondary href="/categorias">Gerenciar categorias</ActionButton><ActionButton secondary href="/locais">Locais de venda</ActionButton></div>
    {editor && <ProductEditor key={editor === 'new' ? 'new' : editor.id} product={editor === 'new' ? undefined : editor} variants={editor === 'new' ? [] : variants.filter(v => v.product_id === editor.id)} categories={categories} onClose={close} />}
    <div className="commerce-filters"><SearchField value={search} onChange={setSearch} placeholder="Buscar produtos" /><label>Categoria<select aria-label="Categoria" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Status<select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="all">Todos</option></select></label></div>
    {error && <p role="alert" className="form-message error">{error}</p>}
    {!filtered.length ? <EmptyState title={search ? 'Nenhum resultado encontrado.' : 'Seu catálogo começa aqui'} description="Cadastre produtos, sabores, preços e custos para registrar sua primeira venda." icon={Package} /> : <div className="catalog-grid">{filtered.map(p => <article className="section-card catalog-card" key={p.id}><div className="section-heading"><h2>{p.name}</h2><StatusBadge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Ativo' : 'Inativo'}</StatusBadge></div><p className="muted">{categories.find(c => c.id === p.category_id)?.name ?? 'Sem categoria'}</p>{variants.filter(v => v.product_id === p.id).map(v => <div className="catalog-option" key={v.id}><span>{v.name}{!v.active && <small> · Indisponível</small>}</span><div><strong>{formatMoney(v.sale_price_cents)}</strong><small>Custo {formatMoney(v.cost_price_cents)}</small></div></div>)}<div className="commerce-actions"><button className="action-button secondary" onClick={() => setEditor(p)} aria-label={`Editar ${p.name}`}>Editar</button><button data-write className="text-link" disabled={!!busy} onClick={() => { if (locked.current) return; locked.current = true; setBusy(p.id); setError(''); startTransition(async () => { try { const result = await toggleProduct(p.id, !p.active); if (result.error) setError(result.error); else if (result.record) setConfirmed(previous => ({ ...previous, [p.id]: result.record as Product })); } catch { setError('Não foi possível alterar o produto.'); } finally { locked.current = false; setBusy(''); } }); }}>{busy === p.id ? 'Salvando…' : p.active ? 'Desativar' : 'Ativar'}</button></div></article>)}</div>}
  </>;
}
