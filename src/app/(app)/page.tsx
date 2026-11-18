import { Dashboard } from '@/features/dashboard/dashboard';
import { requireBusiness } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
export default async function Home() { const context = await requireBusiness(); if (context.membership.role === 'owner') redirect('/equipe'); return <Dashboard businessName={context.business.name} timezone={context.business.timezone} />; }
