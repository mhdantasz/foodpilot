'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="auth-page"><section className="auth-card"><h1>Não conseguimos carregar agora.</h1><p className="auth-description">Tente novamente. Se o problema continuar, verifique a configuração e as migrations do Supabase.</p><button className="action-button" onClick={() => reset()}>Tentar novamente</button><p className="auth-switch"><Link href="/login">Voltar para entrar</Link></p></section></main>;
}
