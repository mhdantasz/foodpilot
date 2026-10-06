import Link from 'next/link';
import { Search, ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
export function ActionButton({ children, href = '/vendas/nova', secondary = false }: { children: ReactNode; href?: string; secondary?: boolean }) {
  return <Link className={`action-button ${secondary ? 'secondary' : ''}`} href={href}>{children}</Link>;
}
export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">SEU NEGÓCIO, BEM CUIDADO</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</header>;
}
export function SectionCard({ title, aside, children, className = '' }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`section-card ${className}`}><div className="section-heading"><h2>{title}</h2>{aside}</div>{children}</section>;
}
export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'success' | 'warning' | 'neutral' | 'info' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function StatCard({ label, value, note, icon: Icon, accent = false }: { label: string; value: string; note: string; icon: LucideIcon; accent?: boolean }) {
  return <article className={`stat-card ${accent ? 'accent' : ''}`}><div className="stat-label">{label}<Icon size={19} aria-hidden="true" /></div><strong>{value}</strong><span className="stat-note">{accent && <ArrowUpRight size={14} aria-hidden="true" />}{note}</span></article>;
}
export function EmptyState({ title, description, icon: Icon, action }: { title: string; description: string; icon: LucideIcon; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={30} aria-hidden="true" /></div><h2>{title}</h2><p>{description}</p>{action}</div>;
}
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">{placeholder}</span><input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></label>;
}
export function ResponsiveContainer({ children }: { children: ReactNode }) { return <div className="responsive-container">{children}</div>; }

