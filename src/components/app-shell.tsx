'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, Ellipsis, X, ArrowUpRight } from 'lucide-react';
import { Brand } from './brand';
import { SessionSync } from './session-sync';
import { navigation } from '@/config/navigation';
import { ResponsiveContainer } from './ui';
import type { ReactNode } from 'react';
function NavLink({ href, label, icon: Icon, onClick }: (typeof navigation)[number] & { onClick?: () => void }) {
  const path = usePathname();
  return <Link href={href} onClick={onClick} aria-current={(path === href || (href !== '/' && path.startsWith(href + '/'))) ? 'page' : undefined} className={`nav-link ${(path === href || (href !== '/' && path.startsWith(href + '/'))) ? 'active' : ''}`}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>;
}
export function Sidebar({ businessName, userName }: { businessName: string; userName: string }) {
  return <aside className="sidebar"><Brand /><div className="business-chip"><span className="business-avatar">{businessName.charAt(0).toUpperCase()}</span><div><strong>{businessName}</strong><small>Seu negócio</small></div></div><p className="nav-caption">PRINCIPAL</p><nav aria-label="Navegação principal">{navigation.slice(0, 8).map(item => <NavLink key={item.href} {...item} />)}</nav><div className="sidebar-bottom"><div className="phase-card"><span className="phase-dot" />Um começo organizado<p>Mais tempo para fazer o que você ama.</p><Link href="/configuracoes">Minha conta <ArrowUpRight size={14} /></Link></div><NavLink {...navigation[8]} /><div className="user-chip"><span className="user-avatar">{userName.charAt(0).toUpperCase()}</span><div><strong>{userName}</strong><small>Pronto</small></div></div></div></aside>;
}
export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const pathname = usePathname();
  const moreActive = navigation.slice(4).some(item => item.href === pathname);
  return <><nav className="mobile-navigation" aria-label="Navegação no celular">{navigation.slice(0, 4).map(item => <NavLink key={item.href} {...item} onClick={() => setOpen(false)} />)}<button className={`nav-link ${moreActive || open ? 'active' : ''}`} aria-expanded={open} aria-controls="more-menu" onClick={() => setOpen(!open)}><Ellipsis size={21} /><span>Mais</span></button></nav>{open && <div className="more-overlay" onClick={() => setOpen(false)}><section id="more-menu" aria-label="Mais páginas" className="more-sheet" onClick={e => e.stopPropagation()}><div className="section-heading"><h2>Mais opções</h2><button className="icon-button" aria-label="Fechar opções" onClick={() => setOpen(false)}><X /></button></div>{navigation.slice(4).map(item => <NavLink key={item.href} {...item} onClick={() => setOpen(false)} />)}</section></div>}</>;
}
export function AppShell({ children, businessName, userName }: { children: ReactNode; businessName: string; userName: string }) {
  return <><SessionSync /><a className="skip-link" href="#main">Pular para conteúdo</a><Sidebar businessName={businessName} userName={userName} /><div className="app-body"><div className="topbar"><div className="mobile-brand"><Brand /></div><span className="topbar-caption">Um pouco de organização. Muitas possibilidades.</span><span className="demo-indicator"><span />Conta conectada</span></div><main id="main"><ResponsiveContainer>{children}</ResponsiveContainer></main><footer className="app-footer">Feito para o seu pequeno grande negócio.<span>Pronto</span></footer></div><Link className="quick-sale" href="/vendas/nova" aria-label="Nova venda"><Plus size={24} /></Link><MobileNavigation /></>;
}

