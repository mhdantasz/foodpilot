import { ModuleRoute } from '@/features/modules/module-route';
import { modules } from '@/features/modules/module-config';

export const metadata = { title: modules.configuracoes.title };
export default function Page() { return <ModuleRoute slug="configuracoes" />; }
