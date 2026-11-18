import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/context';
import { AuthCard } from '@/features/auth/auth-card';
import { OnboardingForm } from '@/features/auth/onboarding-form';
import { LogoutButton } from '@/features/auth/auth-form';
import Link from 'next/link';
export const metadata = { title: 'Preparar negócio' };
export default async function OnboardingPage() {
  const context = await requireUser();
  if (context.seller) redirect('/vendedor');
  if (context.business) redirect('/');
  return <AuthCard title="Vamos configurar seu negócio." description={`Olá, ${context.profile.full_name}. São só três passos para começar.`}><p className="form-message info">Recebeu um convite para vender? <Link href="/vendedor">Aceite o convite da equipe</Link> antes de criar um negócio próprio. Se confirmou o email em outro aparelho, reabra o link enviado pelo gerente.</p><OnboardingForm /><div className="onboarding-logout"><LogoutButton /></div></AuthCard>;
}
