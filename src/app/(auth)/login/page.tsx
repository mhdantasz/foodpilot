import { AuthCard } from '@/features/auth/auth-card';
import { AuthForm } from '@/features/auth/auth-form';
import { redirectAuthenticated } from '@/lib/auth/context';
import { getSupabaseConfig } from '@/lib/supabase/env';
export const metadata = { title: 'Entrar' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ senha?: string; erro?: string }> }) {
  await redirectAuthenticated();
  const params = await searchParams;
  return <AuthCard title="Bom ter você por aqui." description="Entre para continuar cuidando do seu negócio.">{!getSupabaseConfig() && <p className="form-message info" role="status">O Supabase ainda não está configurado. O acesso ficará disponível após a configuração indicada no README.</p>}{params.senha === 'alterada' && <p role="status" className="form-message success">Senha alterada. Entre com sua nova senha.</p>}{params.erro && <p role="alert" className="form-message error">Esse link não está mais disponível. Solicite um novo email de recuperação.</p>}<AuthForm mode="login" /></AuthCard>;
}
