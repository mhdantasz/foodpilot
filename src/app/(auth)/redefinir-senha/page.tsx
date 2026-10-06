import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthCard } from '@/features/auth/auth-card';
import { AuthForm } from '@/features/auth/auth-form';
export const metadata = { title: 'Nova senha' };
export default async function ResetPage() {
  const client = await createClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error) redirect('/esqueci-senha');
  return <AuthCard title="Escolha sua nova senha." description="Sua senha fica protegida pelo Supabase. Não compartilhamos seus dados de acesso."><AuthForm mode="redefinir-senha" /></AuthCard>;
}
