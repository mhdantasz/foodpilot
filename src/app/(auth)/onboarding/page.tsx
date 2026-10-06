import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/context';
import { AuthCard } from '@/features/auth/auth-card';
import { OnboardingForm } from '@/features/auth/onboarding-form';
import { LogoutButton } from '@/features/auth/auth-form';
export const metadata = { title: 'Preparar negócio' };
export default async function OnboardingPage() {
  const context = await requireUser();
  if (context.business) redirect('/');
  return <AuthCard title="Vamos configurar seu negócio." description={`Olá, ${context.profile.full_name}. São só três passos para começar.`}><OnboardingForm /><div className="onboarding-logout"><LogoutButton /></div></AuthCard>;
}
