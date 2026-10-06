import { AuthCard } from '@/features/auth/auth-card';
import { AuthForm } from '@/features/auth/auth-form';
import { redirectAuthenticated } from '@/lib/auth/context';
export const metadata = { title: 'Criar conta' };
export default async function SignupPage() { await redirectAuthenticated(); return <AuthCard title="Seu negócio começa aqui." description="Crie sua conta. Depois, vamos preparar o seu espaço."><AuthForm mode="cadastro" /></AuthCard>; }
