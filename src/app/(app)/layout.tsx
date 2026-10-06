import type { ReactNode } from 'react';
import { requireBusiness } from '@/lib/auth/context';
import { AppShell } from '@/components/app-shell';
export const dynamic = 'force-dynamic';
export default async function PrivateLayout({ children }: { children: ReactNode }) {
  const context = await requireBusiness();
  return <AppShell businessName={context.business.name} userName={context.profile.full_name}>{children}</AppShell>;
}
