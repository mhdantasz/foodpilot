import Link from 'next/link';
import { AuthCard } from '@/features/auth/auth-card';
import { LogoutButton } from '@/features/auth/auth-form';
import { getCurrentContext } from '@/lib/auth/context';
import { invitationPath } from '@/lib/auth/return-to';
import { InvitationForm } from '@/components/invitation-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Convite para a equipe', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const path = invitationPath(code);
  const context = await getCurrentContext();
  return <AuthCard title="Você faz parte da equipe." description="Um acesso só seu para registrar vendas e acompanhar sua comissão.">
    {!path ? <p role="alert" className="form-message error">Este convite é inválido. Peça um novo link ao gerente.</p>
      : !context ? <div className="auth-form"><p>Entre ou crie sua conta para aceitar. Sua senha é pessoal e não precisa ser compartilhada.</p><Link className="action-button" href={`/login?convite=${encodeURIComponent(code!)}`}>Já tenho conta</Link><Link className="action-button secondary" href={`/cadastro?convite=${encodeURIComponent(code!)}`}>Criar meu acesso</Link></div>
        : context.membership ? <div className="auth-form"><p role="alert">Esta conta já está vinculada a um negócio. Use uma conta pessoal sem negócio para aceitar o convite de vendedor.</p><LogoutButton /></div>
          : <><p className="muted">Conectado como {context.profile.full_name}</p><InvitationForm code={code!} /><LogoutButton /></>}
  </AuthCard>;
}
