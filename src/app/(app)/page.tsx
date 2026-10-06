import { Dashboard } from '@/features/dashboard/dashboard';
import { requireBusiness } from '@/lib/auth/context';
export default async function Home() { const context = await requireBusiness(); return <Dashboard businessName={context.business.name} timezone={context.business.timezone} />; }
