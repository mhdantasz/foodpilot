import { requireBusiness } from '@/lib/auth/context';
import { AccountSettings } from '@/features/auth/account-settings';
import { ModulePage } from './module-page';
import type { ModuleSlug } from './module-config';

export async function ModuleRoute({ slug }: { slug: ModuleSlug }) {
  const context = await requireBusiness();
  return slug === 'configuracoes' ? <AccountSettings context={context} /> : <ModulePage slug={slug} />;
}
