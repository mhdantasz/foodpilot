import Link from 'next/link';
import { PageHeader, SectionCard, StatusBadge } from '@/components/ui';
import { LogoutButton } from './auth-form';
import type { requireBusiness } from '@/lib/auth/context';
export function AccountSettings({ context }: { context: Awaited<ReturnType<typeof requireBusiness>> }) {
  return <><PageHeader title="Configurações" description="Sua conta e seu negócio, em um lugar só." action={<StatusBadge tone="info">Conta conectada</StatusBadge>} /><div className="dashboard-main"><SectionCard title="Conta"><dl className="settings-list"><dt>Nome</dt><dd>{context.profile.full_name}</dd><dt>Email</dt><dd>{context.user.email}</dd></dl><LogoutButton /></SectionCard><SectionCard title="Negócio"><dl className="settings-list"><dt>Nome do negócio</dt><dd>{context.business.name}</dd><dt>Moeda</dt><dd>{context.business.currency} · Real brasileiro</dd><dt>Fuso horário</dt><dd>{context.business.timezone}</dd><dt>Seu vínculo</dt><dd>{context.membership.role === 'owner' ? 'Proprietário' : 'Membro'}</dd></dl><div className="commerce-actions"><Link className="action-button secondary" href="/locais">Locais de venda</Link><Link className="action-button secondary" href="/categorias">Categorias</Link></div></SectionCard></div><p className="module-footnote">Os dados estão disponíveis para consulta. A edição será preparada em uma próxima fase.</p></>;
}
