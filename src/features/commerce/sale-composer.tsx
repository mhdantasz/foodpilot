'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Package, Plus, Minus, Trash2, CheckCircle2 } from 'lucide-react';
import { ActionButton, EmptyState, PageHeader, SearchField } from '@/components/ui';
import { createSale } from './actions';
import { SimpleEditor } from './simple-manager';
import { formatMoney, sumCents } from '@/lib/money';
import type { Category, Customer, Location, Product, Variant } from '@/types/database';
import { paymentLabels } from './payments';
import { createReservation } from '@/features/operations/actions';
export function SaleComposer({ products, variants, categories, customers, locations, requestId, reservation = false, initialScheduled = '', timezone }: { products: Product[]; variants: Variant[]; categories: Category[]; customers: Customer[]; locations: Location[]; requestId: string; reservation?: boolean; initialScheduled?: string; timezone?: string }) {
  const [scheduled, setScheduled] = useState(initialScheduled);
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [cart, setCart] = useState<Record<string, number>>({}), [customerId, setCustomerId] = useState(''), [customerSearch, setCustomerSearch] = useState('');
  const activeLocations = locations.filter(l => l.active);
  const [locationId, setLocationId] = useState(activeLocations.length === 1 ? activeLocations[0].id : ''), [payment, setPayment] = useState('pix'), [notes, setNotes] = useState(''), [newCustomer, setNewCustomer] = useState(false), [quickCustomer, setQuickCustomer] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saleId, setSaleId] = useState('');
  const lock = useRef(false), request = useRef(requestId);
  const [savedTotal, setSavedTotal] = useState(0);
  const available = variants.filter(v => v.active && products.some(p => p.id === v.product_id && p.active));
  function label(v: Variant) { const p = products.find(p => p.id === v.product_id)!; return v.name === 'Tradicional' ? p.name : `${p.name} — ${v.name}`; }
  const filtered = available.filter(v => label(v).toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (!category || products.find(p => p.id === v.product_id)?.category_id === category));
  const entries = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ variant: variants.find(v => v.id === id)!, quantity }));
  const total = sumCents(entries.map(e => e.quantity * e.variant.sale_price_cents));
  const count = entries.reduce((n, e) => n + e.quantity, 0);
  function quantity(id: string, value: number) {
    if (busy) return;
    const next = { ...cart, [id]: Math.max(0, Math.min(9999, value)) };
    const revenue = Object.entries(next).reduce((n, [key, q]) => n + q * variants.find(v => v.id === key)!.sale_price_cents, 0);
    const cost = Object.entries(next).reduce((n, [key, q]) => n + q * variants.find(v => v.id === key)!.cost_price_cents, 0);
    if (revenue > 1_000_000_000_000 || cost > 1_000_000_000_000) { setError('Venda acima do limite permitido. Reduza a quantidade.'); return; }
    setCart(next);
  }
  if (saleId) return <><PageHeader title={reservation ? 'Reserva registrada' : 'Venda registrada'} description={reservation ? 'Seu pedido está na lista de reservas.' : 'Tudo certo. Sua venda já está no histórico.'} /><section className="section-card sale-success" role="status"><CheckCircle2 size={44} /><strong>{formatMoney(savedTotal)}</strong><p>{count} itens · {reservation ? 'Pagamento na conversão em venda' : paymentLabels[payment as keyof typeof paymentLabels]}</p>{!reservation && payment==='credit' && <p>O valor foi adicionado às pendências do cliente.</p>}<div className="commerce-actions"><button className="action-button" onClick={() => { request.current = crypto.randomUUID(); setCart({}); setSaleId(''); setCustomerId(''); setNotes(''); setError(''); }}>{reservation ? 'Nova reserva' : 'Nova venda'}</button><ActionButton secondary href={reservation ? '/reservas?periodo=all' : `/vendas/${saleId}`}>{reservation ? 'Ver reservas' : 'Ver venda'}</ActionButton><ActionButton secondary href="/">Voltar ao início</ActionButton></div></section></>;
  return <><PageHeader title={reservation ? 'Nova reserva' : 'Nova venda'} description={reservation ? 'Combine o pedido e a data com seu cliente.' : 'Escolha os produtos e finalize em poucos toques.'} action={<ActionButton secondary href={reservation ? '/reservas' : '/vendas'}>{reservation ? 'Reservas' : 'Histórico'}</ActionButton>} />
    {!available.length ? <EmptyState title="Cadastre seu primeiro produto" description="Adicione preços e custos ao catálogo para começar a vender." icon={Package} action={<ActionButton href="/produtos">Cadastrar produto</ActionButton>} /> : <div className="sale-layout"><section className="section-card sale-catalog"><h2>Produtos</h2><div className="commerce-filters"><SearchField value={search} onChange={setSearch} placeholder="Buscar produto ou sabor" /><label>Categoria<select aria-label="Categoria" value={category} onChange={e => setCategory(e.target.value)}><option value="">Todas</option>{categories.filter(c => c.active).map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label></div><div className="sale-options">{filtered.map(v => <button type="button" className="sale-option" disabled={busy || (!cart[v.id] && entries.length >= 100)} key={v.id} onClick={() => quantity(v.id, (cart[v.id] ?? 0) + 1)} aria-label={`Adicionar ${label(v)}`}><span>{label(v)}</span><strong>{formatMoney(v.sale_price_cents)}</strong><Plus size={18} /></button>)}</div>{!filtered.length && <p className="muted">Nenhum produto encontrado.</p>}</section>
      <section className="section-card sale-cart"><h2>Carrinho <small>· {count} itens</small></h2>{!entries.length && <p className="muted">Toque em um produto para adicionar.</p>}
        {entries.map(e => <article className="cart-item" key={e.variant.id}><div><strong>{label(e.variant)}</strong><span>{formatMoney(e.quantity * e.variant.sale_price_cents)}</span></div><div className="quantity-controls"><button type="button" disabled={busy} className="icon-button" aria-label={`Diminuir ${label(e.variant)}`} onClick={() => quantity(e.variant.id, e.quantity - 1)}><Minus size={16} /></button><output aria-label={`Quantidade de ${label(e.variant)}`}>{e.quantity}</output><button type="button" disabled={busy || e.quantity >= 9999} className="icon-button" aria-label={`Aumentar ${label(e.variant)}`} onClick={() => quantity(e.variant.id, e.quantity + 1)}><Plus size={16} /></button><button type="button" disabled={busy} className="icon-button" aria-label={`Remover ${label(e.variant)}`} onClick={() => quantity(e.variant.id, 0)}><Trash2 size={16} /></button></div></article>)}
        <fieldset className="commerce-form" disabled={busy}>
          <label>Pesquisar cliente<input type="search" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Nome do cliente" /></label>
          <label>Cliente<select aria-label="Cliente" value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Venda sem cliente</option>{quickCustomer && !customers.some(c => c.id === quickCustomer) && <option value={quickCustomer}>Cliente recém-cadastrado</option>}{customers.filter(c => c.active && (c.id === customerId || c.name.toLocaleLowerCase('pt-BR').includes(customerSearch.toLocaleLowerCase('pt-BR')))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <button type="button" className="text-link" onClick={() => setNewCustomer(!newCustomer)}>+ Criar cliente</button>
          <label>Local<select aria-label="Local" value={locationId} onChange={e => setLocationId(e.target.value)}><option value="">Sem local</option>{activeLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <Link className="text-link" href="/locais">Gerenciar locais</Link>
          {reservation ? <label>Data e horário da reserva<input type="datetime-local" value={scheduled} onChange={e=>setScheduled(e.target.value)} required /><small>Horário do negócio · {timezone}</small></label> : <div><p id="payment-label" className="field-label">Pagamento</p><div className="payment-options" role="group" aria-labelledby="payment-label">{Object.entries(paymentLabels).map(([value, text]) => <button key={value} type="button" aria-pressed={payment === value} onClick={() => setPayment(value)}>{text}</button>)}</div>{payment==='credit'&&<p className="muted">Fiado exige cliente. O valor fica pendente até registrar um pagamento.</p>}</div>}
          <label>Observações da venda (opcional)<textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} /></label>
        </fieldset>
        {newCustomer && <SimpleEditor kind="customers" onCancel={() => setNewCustomer(false)} onSaved={id => { setQuickCustomer(id); setCustomerId(id); setNewCustomer(false); }} />}
        {error && <p role="alert" className="form-message error">{error}</p>}
        <div className="sale-finalize"><div><span>Total</span><strong data-testid="sale-total">{formatMoney(total)}</strong></div><button data-write type="button" className="action-button" disabled={busy || !entries.length || newCustomer} onClick={async () => {
          if (lock.current || !entries.length) return; lock.current = true; setBusy(true); setError('');
          try {
            const common={ requestId: request.current, items: entries.map(e => ({ variant_id: e.variant.id, quantity: e.quantity })), customerId, locationId, notes };
            const result = reservation ? await createReservation({...common,scheduled}) : await createSale({...common,payment});
            if (result.error) setError(result.error); else { setSavedTotal(result.total ?? total); setSaleId(result.id!); }
          } catch { setError('Não foi possível confirmar. Tente novamente.'); }
          finally { lock.current = false; setBusy(false); }
        }}>{busy ? 'Registrando…' : reservation ? 'Registrar reserva' : 'Finalizar venda'}</button></div>{busy && <p role="status" className="sr-only">Registrando {reservation ? 'reserva' : 'venda'}</p>}
      </section></div>}
  </>;
}
