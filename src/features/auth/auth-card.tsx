import type { ReactNode } from 'react';
import { Brand } from '@/components/brand';
export function AuthCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="auth-page" id="main"><div className="auth-container"><Brand href="/login" /><section className="auth-card"><p className="eyebrow">SEU NEGÓCIO, BEM CUIDADO</p><h1>{title}</h1><p className="auth-description">{description}</p>{children}</section><p className="auth-footer">Mais organização. Mais tempo para o que você ama.</p></div></main>;
}
