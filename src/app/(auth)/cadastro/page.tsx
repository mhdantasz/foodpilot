import { AuthCard } from '@/features/auth/auth-card';
import { AuthForm } from '@/features/auth/auth-form';
import { redirectAuthenticated } from '@/lib/auth/context';
import { getCurrentContext } from '@/lib/auth/context';
import { invitationPath } from '@/lib/auth/return-to';
import { redirect } from 'next/navigation';
export const metadata = { title: 'Criar conta' };
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ convite?: string }> }) {
  const returnTo = invitationPath((await searchParams).convite);
  if (returnTo) { if (await getCurrentContext()) redirect(returnTo); }
  else await redirectAuthenticated();
  return <AuthCard title={returnTo ? 'Seu acesso à equipe.' : 'Seu negócio começa aqui.'} description={returnTo ? 'Crie sua conta pessoal e confirme seu email para aceitar o convite. Você define sua própria senha.' : 'Crie sua conta. Depois, vamos preparar o seu espaço.'}><AuthForm mode="cadastro" returnTo={returnTo || undefined} /></AuthCard>;
}
