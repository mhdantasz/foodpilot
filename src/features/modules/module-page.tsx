'use client';
import { useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { navigation } from '@/config/navigation';
import { PageHeader, EmptyState, SearchField, StatusBadge } from '@/components/ui';
import { modules, type ModuleSlug } from './module-config';
export function ModulePage({ slug }: { slug: Exclude<ModuleSlug, 'configuracoes'> }) {
  const config = modules[slug];
  const Icon = navigation.find(item => item.href === `/${slug}`)!.icon;
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(false);
  return <><PageHeader title={config.title} description={config.description} action={<StatusBadge tone="info">Estrutura · Em breve</StatusBadge>} /><div className="module-info"><Info size={18} /><p>{config.future} Nenhum dado comercial será salvo nesta fase.</p></div><section className="section-card module-card" aria-label={config.title}><div className="module-toolbar">{config.search ? <SearchField value={query} onChange={setQuery} placeholder={config.search} /> : <h2>Visão do negócio</h2>}<span className="subtle-label">0 registros</span></div><div className="module-columns">{config.columns.map(column => <span key={column}>{column}</span>)}</div><EmptyState icon={Icon} title={query ? 'Nenhum resultado encontrado.' : config.empty} description={query ? `Não há registros para “${query}”.` : config.help} action={<button className="action-button" onClick={() => setNotice(true)}><Plus size={18} />{config.action}</button>} />{notice && <p role="status" className="future-feedback">{config.future} Este botão apresenta o espaço reservado para essa função.</p>}</section><p className="module-footnote">O próximo capítulo começa com uma base organizada.</p></>;
}
