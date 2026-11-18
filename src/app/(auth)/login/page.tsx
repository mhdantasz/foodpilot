import { AuthCard } from '@/features/auth/auth-card';
import { AuthForm } from '@/features/auth/auth-form';
import { redirectAuthenticated } from '@/lib/auth/context';
import { getSupabaseConfig } from '@/lib/supabase/env';
import { getCurrentContext } from '@/lib/auth/context';
import { invitationPath } from '@/lib/auth/return-to';
import { redirect } from 'next/navigation';
export const metadata = { title: 'Entrar' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ senha?: string; erro?: string; convite?: string }> }) {
  const params = await searchParams;
  const returnTo = invitationPath(params.convite);
  if (returnTo) { if (await getCurrentContext()) redirect(returnTo); }
  else await redirectAuthenticated();
  return <AuthCard title="Bom ter você por aqui." description={returnTo ? 'Entre para aceitar o convite da equipe.' : 'Entre para continuar cuidando do seu negócio.'}>{!getSupabaseConfig() && <p className="form-message info" role="status">O Supabase ainda não está configurado. O acesso ficará disponível após a configuração indicada no README.</p>}{params.senha === 'alterada' && <p role="status" className="form-message success">Senha alterada. Entre com sua nova senha.</p>}{params.erro && <p role="alert" className="form-message error">Esse link não está mais disponível. Solicite um novo email de recuperação.</p>}<AuthForm mode="login" returnTo={returnTo || undefined} /></AuthCard>;
}
