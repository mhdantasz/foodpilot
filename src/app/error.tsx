'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="auth-page"><section className="auth-card"><h1>Não conseguimos carregar agora.</h1><p className="auth-description">Verifique sua conexão e tente novamente. Se você estava salvando, confira o histórico antes de repetir uma nova operação.</p><button className="action-button" onClick={() => reset()}>Tentar novamente</button><p className="auth-switch"><Link href="/login">Voltar para entrar</Link></p></section></main>;
}
