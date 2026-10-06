import { AuthCard } from '@/features/auth/auth-card';
import { AuthForm } from '@/features/auth/auth-form';
export const metadata = { title: 'Recuperar senha' };
export default function ForgotPage() { return <AuthCard title="Vamos recuperar seu acesso." description="Informe seu email para receber um link seguro de redefinição."><AuthForm mode="esqueci-senha" /></AuthCard>; }
